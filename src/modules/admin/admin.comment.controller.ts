import httpStatus from "http-status";
import { AppError } from "../../errors";
import { catchAsync, sendResponse } from "../../utils";
import { commentService } from "../comment/comment.service";
import type { TRouteParams } from "../../interface/params";

// Admin moderation delete. Unlike the shared route, this always records the
// admin in the audit log.
const deleteComment = catchAsync<TRouteParams>(async (req, res) => {
  const { id } = req.params;
  const adminEmail = req.user?.email;

  if (!adminEmail) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Unauthorized Access");
  }

  const result = await commentService.deleteComment(id, adminEmail);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Comment deleted successfully",
    data: result,
  });
});

export const adminCommentController = { deleteComment };
