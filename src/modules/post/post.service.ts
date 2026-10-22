import httpStatus from "http-status";
import { JwtPayload } from "jsonwebtoken";
import mongoose from "mongoose";
import { QueryBuilder } from "../../builder";
import { AppError } from "../../errors";
import { deleteBlogEmailConfirmation, sendEmail } from "../../utils";
import Category from "../category/category.model";
import { IComment } from "../comment/comment.interface";
import Comment from "../comment/comment.model";
import Follower from "../follower/follower.model";
import User from "../user/user.model";
import { recordView } from "../view/view.service";
import View from "../view/view.model";
import Vote from "../vote/vote.model";
import { postSearchableFields } from "./post.constant";
import { IPost } from "./post.interface";
import Post from "./post.model";
import { generateUniqueSlug } from "./post.utils";

const create = async (userData: JwtPayload, payload: IPost) => {
  const user = await User.findOne({ email: userData.email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const category = await Category.findById(payload.category);
  if (!category) {
    throw new AppError(httpStatus.NOT_FOUND, "Category not found");
  }

  payload.author = user._id;
  payload.category = category._id;

  // Generate unique slug
  payload.slug = await generateUniqueSlug(payload.title);

  const session = await Post.startSession();

  try {
    // Start transaction
    session.startTransaction();

    // Create a new post within the transaction
    const newPost = await Post.create([{ ...payload }], { session });
    if (newPost.length < 0) {
      throw new AppError(httpStatus.BAD_REQUEST, "Failed to create post");
    }

    // Increment postCount of the category by 1
    const updatedCategory = await Category.findByIdAndUpdate(
      category._id,
      { $inc: { postCount: 1 } }, // Increment the postCount field by 1
      { session, new: true }, // Pass session and return the updated category
    );
    if (!updatedCategory) {
      throw new AppError(httpStatus.BAD_REQUEST, "Failed to update category");
    }

    // Increment total post count 1
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $inc: { totalPosts: 1 } }, // Increment the postCount field by 1
      { session, new: true }, // Pass session and return the updated category
    );

    if (!updatedUser) {
      throw new AppError(httpStatus.BAD_REQUEST, "Failed to update User");
    }

    // Commit the transaction and end the session
    await session.commitTransaction();
    await session.endSession();

    return (
      await newPost[0].populate({
        path: "author",
        select: "fullName email username profilePicture",
      })
    ).populate({
      path: "category",
      select: "name description postCount",
    });
  } catch (err) {
    // Abort transaction in case of an error
    await session.abortTransaction();
    await session.endSession();
    throw err;
  }
};

// get all post (for anyone to see title small part of description, category, views, upvote, downvote etc)
const getAll = async (query: Record<string, unknown>) => {
  const postQuery = new QueryBuilder(
    Post.find({}).populate("author").populate("category"),
    query,
  ).search(postSearchableFields);

  // Await the filter() method
  await postQuery.filter();

  // Now you can safely call sort, paginate, and fields
  postQuery.sort().paginate().fields();

  const result = await postQuery.modelQuery; // Await the results here
  const meta = await postQuery.countTotal();

  return { result, meta };
};

// get following users posts
const getFollowingUsersPosts = async (
  userData: JwtPayload,
  query: Record<string, unknown>,
) => {
  // Step 1: Find the current user by their email
  const user = await User.findOne({ email: userData.email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // Step 2: Find the list of users that the current user is following
  const following = await Follower.find({ follower: user._id }).select(
    "following",
  );

  if (!following || following.length === 0) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "You are not following any users.",
    );
  }

  // Step 3: Extract the user IDs of those being followed
  const followingUserIds = following.map((f) => f.following);

  // Step 4: Query the posts where the author is in the following list
  const postQuery = new QueryBuilder(
    Post.find({
      author: { $in: followingUserIds },
    })
      .populate("author")
      .populate("category"),
    query,
  ).search(postSearchableFields);

  // Await the filter() method
  await postQuery.filter();

  // Now you can safely call sort, paginate, and fields
  postQuery.sort().paginate().fields();

  const result = await postQuery.modelQuery; // Await the results here
  const meta = await postQuery.countTotal();

  return { result, meta };
};

// get current logged in user all posts
const getLoggedInUserPosts = async (
  userData: JwtPayload,
  query: Record<string, unknown>,
) => {
  const user = await User.findOne({ email: userData.email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const postQuery = new QueryBuilder(
    Post.find({ author: user._id, isDeleted: { $ne: true } })
      .populate("author")
      .populate("category"),
    query,
  ).search(postSearchableFields);

  // Await the filter() method
  await postQuery.filter();

  // Now you can safely call sort, paginate, and fields
  postQuery.sort().paginate().fields();

  const result = await postQuery.modelQuery; // Await the results here
  const meta = await postQuery.countTotal();

  return { result, meta };
};

const getPostByProperty = async (key: string, value: string) => {
  let post;

  if (key === "_id") {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new AppError(httpStatus.BAD_REQUEST, "Invalid post Id");
    }
    post = await Post.findById(value).populate("author").populate({
      path: "category",
      select: "name description postCount",
    });
  } else {
    post = await Post.findOne({ [key]: value })
      .populate("author")
      .populate({
        path: "category",
        select: "name description postCount",
      });
  }

  if (!post) {
    throw new AppError(httpStatus.NOT_FOUND, "Post not found");
  }

  return post;
};

// get a single post by slug.
// Guests get a preview: the article body is withheld and `isLocked` is true.
// Logged-in users get the full article and a view is recorded for them.
const getSinglePost = async (userData: JwtPayload | undefined, slug: string) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Fetch the post by its slug
    const post = await Post.findOne({ slug })
      .populate({
        path: "author",
      })
      .populate({
        path: "category",
        select: "name description postCount",
      })
      .session(session);

    if (!post) {
      throw new AppError(httpStatus.NOT_FOUND, "Post not found");
    }

    // Guest visitors can see everything but the article body
    if (!userData?.email) {
      await session.commitTransaction();
      session.endSession();

      const preview = post.toObject() as Partial<IPost> & { isLocked?: boolean };
      preview.isLocked = true;
      delete preview.content;

      return preview;
    }

    // Get the current logged-in user
    const currentLoggedInUser = await User.findOne({
      email: userData.email,
    }).session(session);

    if (!currentLoggedInUser) {
      throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    // Record the view (once per reader, never for the author) and return the
    // reconciled total. This runs outside the read transaction so a concurrent
    // duplicate view can never abort the article fetch itself.
    const totalViews = await recordView(slug, { user: userData });

    // Commit transaction and return the post
    await session.commitTransaction();
    session.endSession();

    return {
      ...post.toObject(),
      totalViews: totalViews ?? post.totalViews,
      isLocked: false,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// vote on post
const voteOnPost = async (
  userData: JwtPayload,
  postId: string,
  voteType: "upvote" | "downvote",
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validate the voteType
    if (!["upvote", "downvote"].includes(voteType)) {
      throw new AppError(httpStatus.BAD_REQUEST, "Invalid vote type");
    }

    // Get the current logged-in user
    const currentLoggedInUser = await User.findOne({
      email: userData.email,
    }).session(session);

    if (!currentLoggedInUser) {
      throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    // Fetch the post by its ID
    const post = await Post.findById(postId).session(session);
    if (!post) {
      throw new AppError(httpStatus.NOT_FOUND, "Post not found");
    }

    // Ensure the user is not the author of the post (skip author's votes if necessary)
    if (post.author.equals(currentLoggedInUser._id)) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Author cannot vote on their own post",
      );
    }

    // Find if the user has already voted on this post
    const existingVote = await Vote.findOne({
      post: post._id,
      user: currentLoggedInUser._id,
    }).session(session);

    if (existingVote) {
      if (existingVote.type === voteType) {
        // If the user clicks the same vote type (toggle functionality)
        await existingVote.deleteOne({ session });

        if (voteType === "upvote") {
          post.upVotes -= 1;
        } else {
          post.downVotes -= 1;
        }
      } else {
        // If the user is switching their vote (from upvote to downvote or vice versa)
        existingVote.type = voteType;
        await existingVote.save({ session });

        if (voteType === "upvote") {
          post.upVotes += 1;
          post.downVotes -= 1;
        } else {
          post.downVotes += 1;
          post.upVotes -= 1;
        }
      }
    } else {
      // If no existing vote, create a new vote
      await Vote.create(
        [
          {
            user: currentLoggedInUser._id,
            post: post._id,
            type: voteType,
          },
        ],
        { session },
      );

      // Increment upvotes or downvotes on the post
      if (voteType === "upvote") {
        post.upVotes += 1;
      } else {
        post.downVotes += 1;
      }
    }

    // Save the post after updating votes
    await post.save({ session });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    return post; // Return the updated post with vote counts
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// get vote status
const getVoteStatus = async (userData: JwtPayload, postId: string) => {
  const user = await User.findOne({ email: userData.email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const post = await Post.findById(postId);
  if (!post) {
    throw new AppError(httpStatus.NOT_FOUND, "Post not found");
  }

  const existingVote = await Vote.findOne({
    post: post._id,
    user: user._id,
  });

  if (!existingVote) {
    throw new AppError(httpStatus.NOT_FOUND, "Not Voted yet!");
  }

  // If the user has voted, return the vote type and relevant metadata
  return {
    status: "Voted",
    voteType: existingVote.type, // "upvote" or "downvote"
    postId: post._id,
    userId: user._id,
  };
};

// comment on post with transaction
const commentOnPost = async (
  userData: JwtPayload,
  postId: string,
  payload: IComment,
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Find the current logged-in user
    const currentLoggedInUser = await User.findOne({
      email: userData.email,
    }).session(session);

    if (!currentLoggedInUser) {
      throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    // Fetch the post by its ID
    const post = await Post.findById(postId).session(session);
    if (!post) {
      throw new AppError(httpStatus.NOT_FOUND, "Post not found");
    }

    // Create a new comment
    const comment = await Comment.create(
      [
        {
          ...payload,
          user: currentLoggedInUser._id,
          post: post._id,
        },
      ],
      { session },
    );

    // Keep the stored counter equal to the number of visible comments rather
    // than incrementing blindly, so edits and removals can never drift it.
    // The count must join the transaction, or the new comment is not visible to
    // it and the counter is written back as zero.
    post.totalComments = await Comment.countDocuments({
      post: post._id,
      isDeleted: { $ne: true },
    }).session(session);
    await post.save({ session });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // Find and populate the comment with specific fields from user and post
    return await Comment.findById(comment[0]._id)
      .populate({
        path: "user",
        select: "fullName email profilePicture",
      })
      .populate({
        path: "post",
        select: "title category slug",
      });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// get all comments by post id
const getAllCommentsByPostId = async (
  postId: string,
  query: Record<string, unknown>,
) => {
  // Fetch the post by its ID
  const post = await Post.findById(postId);
  if (!post) {
    throw new AppError(httpStatus.NOT_FOUND, "Post not found");
  }

  // Only visible comments: a soft-deleted comment stays in the collection for
  // moderation history, but it must not appear in the list or the count.
  const commentQuery = new QueryBuilder(
    Comment.find({ post: post._id, isDeleted: { $ne: true } })
      .populate("user")
      .populate("post"),
    query,
  );

  // Await the filter() method
  await commentQuery.filter();

  // Now you can safely call sort, paginate, and fields
  commentQuery.sort().paginate().fields();

  const result = await commentQuery.modelQuery; // Await the results here
  const meta = await commentQuery.countTotal();

  return { result, meta };
};

// get all posts by user id
const getAllPostsByUserId = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // The author's real article count is the source of truth for a profile, so it
  // cannot lag behind like the stored `user.totalPosts` counter did. Deleted
  // posts are not on the list, so they must not be in its total either.
  const visibleFilter = { author: user._id, isDeleted: { $ne: true } };
  const total = await Post.countDocuments(visibleFilter);

  const postQuery = new QueryBuilder(
    Post.find(visibleFilter).populate("author").populate("category"),
    query,
  ).search(postSearchableFields);

  // Await the filter() method
  await postQuery.filter();

  // Newest first: the default sort only applies when the caller doesn't ask
  // for something else, and `createdAt` alone can tie within one millisecond.
  if (!query.sort) {
    postQuery.sortBy("-createdAt,-_id");
  } else {
    postQuery.sort();
  }

  postQuery.paginate().fields();

  const result = await postQuery.modelQuery; // Await the results here
  const meta = await postQuery.countTotal();
  meta.total = total;

  return { result, meta };
};

// delete post by admin using id
const deletePostByAdminUsingId = async (
  id: string,
  payload: Record<string, string>,
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Find the post and populate the author with specific fields
    const post = await Post.findById(id)
      .populate({ path: "author", select: "fullName email" })
      .session(session);
    if (!post) {
      throw new AppError(httpStatus.NOT_FOUND, "Post not found");
    }

    const author = await User.findByIdAndUpdate(post?.author._id, {
      $inc: { totalPosts: -1 },
    }).session(session);

    if (!author) {
      throw new AppError(httpStatus.NOT_FOUND, "Author not found");
    }

    // Soft delete the post
    post.isDeleted = true;
    await post.save({ session });

    // delete associated comments, views, and votes
    await Comment.deleteMany({ post: post._id }, { session });
    await View.deleteMany({ post: post._id }, { session });
    await Vote.deleteMany({ post: post._id }, { session });
    await Category.findByIdAndUpdate(
      post.category,
      {
        $inc: { postCount: -1 },
      },
      { session },
    );

    // Commit the transaction
    await session.commitTransaction();
    await session.endSession();

    // Send email notification to the author
    await sendEmail({
      to: {
        name: author.fullName,
        address: author.email,
      },
      subject: "Your blog post has been deleted",
      html: deleteBlogEmailConfirmation(post.title, payload.reason),
      text: "Your blog post has been deleted",
    });

    // eslint-disable-next-line no-console
    console.log("Post soft-deleted, email sent successfully.");
  } catch (error) {
    // Abort the transaction in case of an error
    await session.abortTransaction();
    await session.endSession();
    throw error;
  }
};

// delete post by user
const deletePostByUserUsingId = async (
  userData: JwtPayload,
  postId: string,
) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const user = await User.findOneAndUpdate(
      { email: userData.email },
      { $inc: { totalPosts: -1 } },
    ).session(session);
    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    const post = await Post.findOne({ _id: postId, author: user._id }).session(
      session,
    );
    if (!post) {
      throw new AppError(httpStatus.NOT_FOUND, "Post not found");
    }

    // Soft delete the post
    post.isDeleted = true;
    const result = await post.save({ session });

    // delete associated comments, views, and votes
    await Comment.deleteMany({ post: post._id }, { session });
    await View.deleteMany({ post: post._id }, { session });
    await Vote.deleteMany({ post: post._id }, { session });
    await Category.findByIdAndUpdate(
      post.category,
      {
        $inc: { postCount: -1 },
      },
      { session },
    );

    // Commit the transaction
    await session.commitTransaction();
    await session.endSession();

    // Send email notification to the author
    // await sendEmail({
    //   to: {
    //     name: user.fullName,
    //     address: user.email,
    //   },
    //   subject: "Your blog post has been deleted",
    //   html: deleteBlogEmailConfirmation(post.title, "User deletion"),
    //   text: "Your blog post has been deleted",
    // });

    return result;
  } catch (err) {
    await session.abortTransaction();
    await session.endSession();
    throw err;
  }
};

// update post by user using post id
const updatePostByUserUsingId = async (
  userData: JwtPayload,
  postId: string,
  payload: IPost,
) => {
  const user = await User.findOne({ email: userData.email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // Generate unique slug
  payload.slug = await generateUniqueSlug(payload.title);

  const post = await Post.findOneAndUpdate(
    { _id: postId, author: user._id },
    { ...payload },
    { new: true, runValidators: true },
  );

  if (!post) {
    throw new AppError(httpStatus.NOT_FOUND, "Post not found");
  }

  return post;
};

const updatePostByAdmin = async (
  postId: string,
  payload: IPost & { userId: string },
) => {
  const user = await User.findById(payload.userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (payload.title) {
    // Generate unique slug
    payload.slug = await generateUniqueSlug(payload.title);
  }

  const updatedPost = await Post.findByIdAndUpdate(
    postId,
    { ...payload },
    { new: true, runValidators: true },
  );
  if (!updatedPost) {
    throw new AppError(httpStatus.NOT_FOUND, "Post not found");
  }

  return updatedPost;
};

export const postService = {
  create,
  getAll,
  getLoggedInUserPosts,
  getSinglePost,
  getPostByProperty,
  voteOnPost,
  commentOnPost,
  getAllCommentsByPostId,
  getAllPostsByUserId,
  getVoteStatus,
  getFollowingUsersPosts,
  deletePostByAdminUsingId,
  deletePostByUserUsingId,
  updatePostByUserUsingId,
  updatePostByAdmin,
};
