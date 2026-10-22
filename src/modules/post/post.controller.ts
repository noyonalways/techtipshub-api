import httpStatus from "http-status";
import { catchAsync, sendResponse } from "../../utils";
import { postService } from "./post.service";
import type { TRouteParams } from "../../interface/params";

const create = catchAsync(async (req, res) => {
  const result = await postService.create(req.user, req.body);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Post created successfully",
    data: result,
  });
});

const getAll = catchAsync(async (req, res) => {
  const { meta, result } = await postService.getAll(req.query);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Posts retrieved successfully",
    meta,
    data: result,
  });
});

// get following users posts
const getFollowingUsersPosts = catchAsync(async (req, res) => {
  const { result, meta } = await postService.getFollowingUsersPosts(
    req.user,
    req.query,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Posts retrieved successfully",
    meta,
    data: result,
  });
});

const getLoggedInUserPosts = catchAsync(async (req, res) => {
  const { meta, result } = await postService.getLoggedInUserPosts(
    req.user,
    req.query,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Posts retrieved successfully",
    meta,
    data: result,
  });
});

// get access free blog post if premium then pass to next controller / middleware
const getFreeSinglePost = catchAsync<TRouteParams>(async (req, res, next) => {
  const { slug } = req.params;
  const post = await postService.getPostByProperty("slug", slug);

  if (!post.isPremium) {
    return sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Post retrieved successfully",
      data: post,
    });
  }

  next();
});

const getPremiumSinglePost = catchAsync<TRouteParams>(async (req, res) => {
  const { slug } = req.params;
  const result = await postService.getPremiumSinglePost(req.user, slug);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Post retrieved successfully",
    data: result,
  });
});

// vote
const voteOnPost = catchAsync<TRouteParams>(async (req, res) => {
  const { id } = req.params;
  const { voteType } = req.query;

  const result = await postService.voteOnPost(
    req.user,
    id,
    voteType as "upvote" | "downvote",
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Vote on post successfully updated",
    data: result,
  });
});

// get vote status
const getVoteStatus = catchAsync<TRouteParams>(async (req, res) => {
  const { id } = req.params;
  const result = await postService.getVoteStatus(req.user, id);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Vote status retrieved successfully",
    data: result,
  });
});

// comment on post
const commentOnPost = catchAsync<TRouteParams>(async (req, res) => {
  const { id } = req.params;
  const result = await postService.commentOnPost(req.user, id, req.body);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Add comment successfully",
    data: result,
  });
});

// get all comments by post id
const getAllCommentsByPostId = catchAsync<TRouteParams>(async (req, res) => {
  const { id } = req.params;
  const { result, meta } = await postService.getAllCommentsByPostId(
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

// get all posts by user id
const getAllPostsByUserId = catchAsync<TRouteParams>(async (req, res) => {
  const { userId } = req.params;
  const { result, meta } = await postService.getAllPostsByUserId(
    userId,
    req.query,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Posts retrieved successfully",
    meta,
    data: result,
  });
});

// delete a post by admin using admin
const deletePostByAdminUsingId = catchAsync<TRouteParams>(async (req, res) => {
  const { id } = req.params;

  const result = await postService.deletePostByAdminUsingId(id, req.body);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Post deleted successfully",
    data: result,
  });
});

// delete post by user using post id
const deletePostByUserUsingId = catchAsync<TRouteParams>(async (req, res) => {
  const { id } = req.params;

  const result = await postService.deletePostByUserUsingId(req.user, id);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Post deleted successfully",
    data: result,
  });
});

// update post by user using post id
const updatePostByUserUsingId = catchAsync<TRouteParams>(async (req, res) => {
  const { id } = req.params;

  const result = await postService.updatePostByUserUsingId(
    req.user,
    id,
    req.body,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Post updated successfully",
    data: result,
  });
});

const updatePostByAdmin = catchAsync<TRouteParams>(async (req, res) => {
  const { id } = req.params;

  const result = await postService.updatePostByAdmin(id, req.body);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Post updated successfully",
    data: result,
  });
});

export const postController = {
  create,
  getAll,
  getLoggedInUserPosts,
  getFreeSinglePost,
  getPremiumSinglePost,
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
