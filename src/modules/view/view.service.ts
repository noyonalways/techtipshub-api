import { JwtPayload } from "jsonwebtoken";
import { Types } from "mongoose";
import Post from "../post/post.model";
import View from "./view.model";

export interface IViewerIdentity {
  /** Decoded access token when the reader is signed in. */
  user?: JwtPayload;
  /** Pseudonymous guest key derived on the server (cookie id + hashed IP/UA). */
  visitorKey?: string;
}

const isSameAuthor = (
  author: Types.ObjectId | { _id: Types.ObjectId },
  userId: unknown,
) => String((author as { _id: Types.ObjectId })._id ?? author) === String(userId);

/**
 * Record a view for `slug` once per reader and return the post's fresh view
 * total, or `null` when there is no post with that slug.
 *
 * Rules, kept deliberately simple so the number means one thing everywhere
 * ("distinct people who read this article"):
 * - Authors and signed-in admins do not add to their own/anyone's count.
 * - A reader counts once, whether they are signed in or a guest.
 * - `totalViews` is rewritten from the real view count rather than incremented,
 *   so the stored number can never drift from the underlying records.
 */
export const recordView = async (
  slug: string,
  identity: IViewerIdentity,
): Promise<number | null> => {
  const post = await Post.findOne({ slug }).select("_id author totalViews");
  if (!post) return null;

  // Nothing to attribute: a guest without a key or a signed-in user.
  if (!identity.user?.email && !identity.visitorKey) {
    return post.totalViews ?? 0;
  }

  if (identity.user?.email) {
    if (isSameAuthor(post.author, identity.user._id)) {
      return post.totalViews ?? 0;
    }

    // Admin activity is not reader interest.
    if (identity.user.role === "Admin") {
      return post.totalViews ?? 0;
    }
  }

  const query: Record<string, unknown> = { post: post._id };
  if (identity.user?._id) {
    // Signed-in readers are keyed by account: one view per person per post,
    // across devices and browsers.
    query.user = identity.user._id;
    query.visitorKey = `user:${String(identity.user._id)}`;
  } else {
    query.visitorKey = `guest:${identity.visitorKey}`;
  }

  // Upsert on the unique { post, visitorKey } index: concurrent requests for
  // the same reader resolve to one record instead of racing.
  try {
    await View.updateOne(
      { post: post._id, visitorKey: query.visitorKey },
      { $setOnInsert: { ...query, viewedAt: new Date() } },
      { upsert: true },
    );
  } catch (upsertError: any) {
    // A concurrent request may have won the unique index race; that is a
    // duplicate view, not an error, so fall through to the recount.
    if (upsertError?.code !== 11000) throw upsertError;
  }

  const total = await View.countDocuments({ post: post._id });
  await Post.updateOne({ _id: post._id }, { $set: { totalViews: total } });

  return total;
};
