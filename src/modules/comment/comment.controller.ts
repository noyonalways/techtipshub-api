import httpStatus from "http-status";
import { catchAsync, sendResponse } from "../../utils";
import { commentService } from "./comment.service";
import type { TRouteParams } from "../../interface/params";

const deleteComment = catchAsync<TRouteParams>(async (req, res) => {
  const { id } = req.params;
  const isAdmin = req.user?.role === "Admin";

  const result = await commentService.deleteComment(
    id,
    isAdmin ? req.user.email : undefined,
    isAdmin ? undefined : req.user?.email,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Comment deleted successfully",
    data: result,
  });
});

const updateComment = catchAsync<TRouteParams>(async (req, res) => {
  const { id } = req.params;

  const result = await commentService.updateComment(id, req.body);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Comment updated successfully",
    data: result,
  });
});

const getAll = catchAsync(async (req, res) => {
  const { result, meta } = await commentService.getAll(req.query);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Comments retrieved successfully",
    meta,
    data: result,
  });
});

const getLatest = catchAsync(async (req, res) => {
  const result = await commentService.getLatest(req.query.limit);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Latest comments retrieved successfully",
    data: result,
  });
});

const getCounts = catchAsync(async (_req, res) => {
  const result = await commentService.getCounts();

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Comment counts retrieved successfully",
    data: result,
  });
});

export const commentController = {
  deleteComment,
  updateComment,
  getAll,
  getLatest,
  getCounts,
};
