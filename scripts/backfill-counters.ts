/**
 * One-off backfill for view/comment counters. Safe to re-run:
 *  - gives legacy view records the new `visitorKey` format,
 *  - rebuilds every post's `totalViews` and `totalComments` from real records,
 *  - refreshes each user's `totalPosts` from their non-deleted posts.
 *
 * Run with: npx tsx scripts/backfill-counters.ts
 */
import mongoose from "mongoose";
import connectToDatabase from "../src/db";
import Comment from "../src/modules/comment/comment.model";
import Post from "../src/modules/post/post.model";
import User from "../src/modules/user/user.model";
import View from "../src/modules/view/view.model";

const run = async () => {
  await connectToDatabase();

  // 1. Legacy views got a `user` but no `visitorKey`.
  const legacy = await View.collection
    .find({ visitorKey: { $exists: false }, user: { $exists: true } })
    .toArray();

  for (const view of legacy) {
    await View.collection.updateOne(
      { _id: view._id },
      { $set: { visitorKey: `user:${String(view.user)}` } },
    );
  }

  // 2. Drop duplicates so the unique index can be created. The legacy
  //    {post,user} index was unique, which blocks any second guest (they share
  //    a null `user`); it becomes a plain lookup index.
  const indexName = "post_1_visitorKey_1";
  if (!(await View.collection.indexes()).some((index) => index.name === indexName)) {
    const duplicates = await View.collection
      .aggregate([
        { $group: { _id: { post: "$post", visitorKey: "$visitorKey" }, ids: { $push: "$_id" }, n: { $sum: 1 } } },
        { $match: { n: { $gt: 1 } } },
      ])
      .toArray();

    for (const duplicate of duplicates) {
      await View.collection.deleteMany({ _id: { $in: duplicate.ids.slice(1) } });
    }

    await View.collection.createIndex(
      { post: 1, visitorKey: 1 },
      { unique: true, name: indexName },
    );
  }

  // Replace the legacy unique {post,user} index with a plain one.
  const indexes = await View.collection.indexes();
  const legacyUserIndex = indexes.find((index) => index.name === "post_1_user_1");
  if (legacyUserIndex?.unique) {
    await View.collection.dropIndex("post_1_user_1");
    await View.collection.createIndex({ post: 1, user: 1 }, { name: "post_1_user_1" });
  }

  // 3. Rebuild post counters.
  const [viewTotals, commentTotals, postCounts] = await Promise.all([
    View.collection.aggregate([{ $group: { _id: "$post", n: { $sum: 1 } } }]).toArray(),
    Comment.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: "$post", n: { $sum: 1 } } },
    ]),
    Post.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: "$author", n: { $sum: 1 } } },
    ]),
  ]);

  const views = new Map(viewTotals.map((row) => [String(row._id), row.n]));
  const comments = new Map(commentTotals.map((row) => [String(row._id), row.n]));
  const posts = new Map(postCounts.map((row) => [String(row._id), row.n]));

  const allPosts = await Post.find({}).select("_id totalViews totalComments");
  let updatedPosts = 0;
  for (const post of allPosts) {
    const key = String(post._id);
    const totalViews = views.get(key) ?? 0;
    const totalComments = comments.get(key) ?? 0;
    if (post.totalViews !== totalViews || post.totalComments !== totalComments) {
      await Post.updateOne({ _id: post._id }, { $set: { totalViews, totalComments } });
      updatedPosts += 1;
    }
  }

  const allUsers = await User.find({}).select("_id totalPosts").setOptions({ bypassMiddleware: true });
  let updatedUsers = 0;
  for (const user of allUsers) {
    const totalPosts = posts.get(String(user._id)) ?? 0;
    if (user.totalPosts !== totalPosts) {
      await User.collection.updateOne({ _id: user._id }, { $set: { totalPosts } });
      updatedUsers += 1;
    }
  }

  console.log(
    `legacy views keyed: ${legacy.length}, posts updated: ${updatedPosts}/${allPosts.length}, users updated: ${updatedUsers}/${allUsers.length}`,
  );

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
