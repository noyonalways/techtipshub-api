import httpStatus from "http-status";
import mongoose from "mongoose";
import { AppError } from "../../errors";
import Post from "../post/post.model";
import { IComment } from "./comment.interface";
import Comment from "./comment.model";

const deleteComment = async (commentId: string) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find the comment to be deleted
    const comment = await Comment.findByIdAndUpdate(
      commentId,
      { isDeleted: true },
      { session, new: true, runValidators: true },
    );
    if (!comment) {
      throw new AppError(httpStatus.NOT_FOUND, "Comment not found");
    }

    // Check if the associated post exists and re-count its visible comments.
    // The read joins the transaction so it sees this comment as deleted; on its
    // own it would count the old state and write the counter back unchanged.
    const post = await Post.findById(comment.post).session(session);
    if (!post) {
      throw new AppError(httpStatus.NOT_FOUND, "Associated post not found");
    }

    post.totalComments = await Comment.countDocuments({
      post: post._id,
      isDeleted: { $ne: true },
    }).session(session);
    await post.save({ session });

    await session.commitTransaction();

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

export const commentService = {
  deleteComment,
  updateComment,
};
