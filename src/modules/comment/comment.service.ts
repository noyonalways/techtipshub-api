import httpStatus from "http-status";
import mongoose from "mongoose";
import { QueryBuilder } from "../../builder";
import { AppError } from "../../errors";
import { adminLogService } from "../admin/admin-log.service";
import Blog from "../blog/blog.model";
import User from "../user/user.model";
import { IComment } from "./comment.interface";
import Comment from "./comment.model";

const DAY_MS = 24 * 60 * 60 * 1000;

/** `within` tabs on the moderation table. */
const COMMENT_WINDOWS = {
  "24h": DAY_MS,
  "7d": 7 * DAY_MS,
} as const;

type TCommentWindow = keyof typeof COMMENT_WINDOWS | "all";
const COMMENT_WINDOW_VALUES: TCommentWindow[] = ["24h", "7d", "all"];

const isCommentWindow = (value: string): value is TCommentWindow =>
  (COMMENT_WINDOW_VALUES as string[]).includes(value);

const deleteComment = async (
  commentId: string,
  adminEmail?: string,
  requesterEmail?: string,
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // The shared member route passes the caller so one member cannot delete
    // another's comment. Admins delete from the admin route, which passes no
    // requester and always logs the action.
    if (!adminEmail && requesterEmail) {
      const owner = await User.findOne({ email: requesterEmail })
        .select("_id")
        .session(session);

      const owned = owner
        ? await Comment.findOne({
            _id: commentId,
            user: owner._id,
          }).session(session)
        : null;

      if (!owned) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "You can only delete your own comments",
        );
      }
    }

    // Find the comment to be deleted
    const comment = await Comment.findByIdAndUpdate(
      commentId,
      { isDeleted: true },
      { session, new: true, runValidators: true },
    );
    if (!comment) {
      throw new AppError(httpStatus.NOT_FOUND, "Comment not found");
    }

    // Check if the associated blog exists and re-count its visible comments.
    // The read joins the transaction so it sees this comment as deleted; on its
    // own it would count the old state and write the counter back unchanged.
    // `comment.post` stays as-is because that is the stored field name.
    const blog = await Blog.findById(comment.post).session(session);
    if (!blog) {
      throw new AppError(httpStatus.NOT_FOUND, "Associated blog not found");
    }

    blog.totalComments = await Comment.countDocuments({
      post: blog._id,
      isDeleted: { $ne: true },
    }).session(session);
    await blog.save({ session });

    await session.commitTransaction();

    // Only admin deletions are moderation actions worth an audit entry.
    if (adminEmail) {
      await adminLogService.record({
        adminEmail,
        action: "comment.delete",
        targetType: "comment",
        targetId: String(comment._id),
        summary: `Deleted a comment on "${blog.title}"`,
        meta: { blog: String(blog._id) },
      });
    }

    return comment;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const updateComment = async (commentId: string, payload: IComment) => {
  const updatedComment = await Comment.findByIdAndUpdate(commentId, payload, {
    new: true,
    runValidators: true,
  });
  if (!updatedComment) {
    throw new AppError(httpStatus.NOT_FOUND, "Comment not found");
  }
  return updatedComment;
};

const getAll = async (query: Record<string, unknown>) => {
  // Whitelisted keys only: QueryBuilder.filter() splices the raw query string
  // into the Mongo filter, so unvetted keys could carry operators.
  const parsed: Record<string, unknown> = {};

  if (typeof query.searchTerm === "string")
    parsed.searchTerm = query.searchTerm;
  if (typeof query.sort === "string") parsed.sort = query.sort;
  if (typeof query.page === "string" && query.page) parsed.page = query.page;
  if (typeof query.limit === "string" && query.limit)
    parsed.limit = query.limit;
  if (typeof query.fields === "string" && query.fields)
    parsed.fields = query.fields;

  if (
    typeof query.post === "string" &&
    mongoose.Types.ObjectId.isValid(query.post)
  ) {
    parsed.post = query.post;
  }
  if (
    typeof query.user === "string" &&
    mongoose.Types.ObjectId.isValid(query.user)
  ) {
    parsed.user = query.user;
  }

  // "Last 24 hours" / "last 7 days" tabs. Validated here so the panel never has
  // to approximate them client-side.
  let createdAt: { $gte: Date } | undefined;
  const rawWithin = typeof query.within === "string" ? query.within.trim() : "";
  if (rawWithin) {
    if (!isCommentWindow(rawWithin)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `within must be one of ${COMMENT_WINDOW_VALUES.join(", ")}`,
      );
    }

    if (rawWithin !== "all") {
      createdAt = { $gte: new Date(Date.now() - COMMENT_WINDOWS[rawWithin]) };
    }
  }

  const visibility = {
    isDeleted: { $ne: true },
    ...(createdAt ? { createdAt } : {}),
  };

  const commentQuery = new QueryBuilder(
    Comment.find(visibility)
      .populate({
        path: "user",
        select: "fullName username email profilePicture",
      })
      .populate({ path: "post", select: "title slug" }),
    parsed,
  ).search(["content"]);

  await commentQuery.filter();

  if (!parsed.sort) {
    commentQuery.sortBy("-createdAt,-_id");
  } else {
    commentQuery.sort();
  }

  commentQuery.paginate().fields();

  const result = await commentQuery.modelQuery;
  const meta = await commentQuery.countTotal();

  return { result, meta };
};

const getLatest = async (rawLimit: unknown) => {
  const requested = Number(rawLimit);
  const limit =
    Number.isFinite(requested) && requested > 0
      ? Math.min(20, Math.trunc(requested))
      : 5;

  return Comment.find({ isDeleted: { $ne: true } })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .populate({
      path: "user",
      select: "fullName username email profilePicture",
    })
    .populate({ path: "post", select: "title slug" })
    .lean();
};

const getCounts = async () => {
  const now = Date.now();

  const [total, last24h, last7d] = await Promise.all([
    Comment.countDocuments({ isDeleted: { $ne: true } }),
    Comment.countDocuments({
      isDeleted: { $ne: true },
      createdAt: { $gte: new Date(now - DAY_MS) },
    }),
    Comment.countDocuments({
      isDeleted: { $ne: true },
      createdAt: { $gte: new Date(now - 7 * DAY_MS) },
    }),
  ]);

  return { total, last24h, last7d };
};

export const commentService = {
  deleteComment,
  updateComment,
  getAll,
  getLatest,
  getCounts,
};
