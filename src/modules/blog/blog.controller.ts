import httpStatus from "http-status";
import { catchAsync, sendResponse } from "../../utils";
import { blogService } from "./blog.service";
import type { TRouteParams } from "../../interface/params";

const create = catchAsync(async (req, res) => {
  const result = await blogService.create(req.user, req.body);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Blog created successfully",
    data: result,
  });
});

const getAll = catchAsync(async (req, res) => {
  const { meta, result } = await blogService.getAll(req.query);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Blogs retrieved successfully",
    meta,
    data: result,
  });
});

// get following users blogs
const getFollowingUsersBlogs = catchAsync(async (req, res) => {
  const { result, meta } = await blogService.getFollowingUsersBlogs(
    req.user,
    req.query,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Blogs retrieved successfully",
    meta,
    data: result,
  });
});

const getLoggedInUserBlogs = catchAsync(async (req, res) => {
  const { meta, result } = await blogService.getLoggedInUserBlogs(
    req.user,
    req.query,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Blogs retrieved successfully",
    meta,
    data: result,
  });
});

// get a single blog by slug.
// Guests receive a preview; logged-in users receive the full article.
const getSingleBlog = catchAsync<TRouteParams>(async (req, res) => {
  const { slug } = req.params;
  const result = await blogService.getSingleBlog(req.user, slug);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Blog retrieved successfully",
    data: result,
  });
});

// vote
const voteOnBlog = catchAsync<TRouteParams>(async (req, res) => {
  const { id } = req.params;
  const { voteType } = req.query;

  const result = await blogService.voteOnBlog(
    req.user,
    id,
    voteType as "upvote" | "downvote",
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Vote on blog successfully updated",
    data: result,
  });
});

// get vote status
const getVoteStatus = catchAsync<TRouteParams>(async (req, res) => {
  const { id } = req.params;
  const result = await blogService.getVoteStatus(req.user, id);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Vote status retrieved successfully",
    data: result,
  });
});

// comment on blog
const commentOnBlog = catchAsync<TRouteParams>(async (req, res) => {
  const { id } = req.params;
  const result = await blogService.commentOnBlog(req.user, id, req.body);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Add comment successfully",
    data: result,
  });
});

// get all comments by blog id
const getAllCommentsByBlogId = catchAsync<TRouteParams>(async (req, res) => {
  const { id } = req.params;
  const { result, meta } = await blogService.getAllCommentsByBlogId(
    id,
    req.query,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Comments retrieved successfully",
    meta,
    data: result,
  });
});

// get all blogs by user id
const getAllBlogsByUserId = catchAsync<TRouteParams>(async (req, res) => {
  const { userId } = req.params;
  const { result, meta } = await blogService.getAllBlogsByUserId(
    userId,
    req.query,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Blogs retrieved successfully",
    meta,
    data: result,
  });
});

// delete a blog by admin using admin
const deleteBlogByAdminUsingId = catchAsync<TRouteParams>(async (req, res) => {
  const { id } = req.params;

  const result = await blogService.deleteBlogByAdminUsingId(
    id,
    req.body,
    req.user.email,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Blog deleted successfully",
    data: result,
  });
});

// admin article table: every live article, server-side filtered and paged
const getAdminList = catchAsync(async (req, res) => {
  const { result, meta } = await blogService.getAdminList(req.query);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Blogs retrieved successfully",
    meta,
    data: result,
  });
});

const getDeletedBlogs = catchAsync(async (req, res) => {
  const { result, meta } = await blogService.getDeletedBlogs(req.query);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Deleted blogs retrieved successfully",
    meta,
    data: result,
  });
});

const restoreBlog = catchAsync<TRouteParams>(async (req, res) => {
  const { id } = req.params;

  const result = await blogService.restoreBlog(id, req.user.email);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message:
      "Blog restored successfully. Its comments, views and votes were removed when it was deleted, so they are not back.",
    data: result,
  });
});

// delete blog by user using blog id
const deleteBlogByUserUsingId = catchAsync<TRouteParams>(async (req, res) => {
  const { id } = req.params;

  const result = await blogService.deleteBlogByUserUsingId(req.user, id);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Blog deleted successfully",
    data: result,
  });
});

// update blog by user using blog id
const updateBlogByUserUsingId = catchAsync<TRouteParams>(async (req, res) => {
  const { id } = req.params;

  const result = await blogService.updateBlogByUserUsingId(
    req.user,
    id,
    req.body,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Blog updated successfully",
    data: result,
  });
});

const updateBlogByAdmin = catchAsync<TRouteParams>(async (req, res) => {
  const { id } = req.params;

  const result = await blogService.updateBlogByAdmin(id, req.body);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Blog updated successfully",
    data: result,
  });
});

export const blogController = {
  create,
  getAll,
  getLoggedInUserBlogs,
  getSingleBlog,
  voteOnBlog,
  commentOnBlog,
  getAllCommentsByBlogId,
  getAllBlogsByUserId,
  getVoteStatus,
  getFollowingUsersBlogs,
  deleteBlogByAdminUsingId,
  deleteBlogByUserUsingId,
  updateBlogByUserUsingId,
  updateBlogByAdmin,
  getAdminList,
  getDeletedBlogs,
  restoreBlog,
};
