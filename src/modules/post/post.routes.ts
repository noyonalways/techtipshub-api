import { NextFunction, Request, Response, Router } from "express";
import { multerUpload } from "../../config/multer.config";
import { USER_ROLE } from "../../constant";
import { auth, optionalAuth, validateRequest } from "../../middlewares";
import { catchAsync } from "../../utils";
import { commentValidationSchema } from "../comment/comment.validation";
import { postController } from "./post.controller";
import { postValidationSchema } from "./post.validation";

const postRouter: Router = Router();

// write a post
postRouter.post(
  "/",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  multerUpload.single("image"),
  (req: Request, _res: Response, next: NextFunction) => {
    if (req.file?.path) {
      req.body.data = JSON.stringify({
        ...JSON.parse(req.body.data),
        coverImage: req.file.path,
      });
    }
    req.body = { ...JSON.parse(req.body.data) };

    next();
  },
  validateRequest(postValidationSchema.create),
  postController.create,
);

// anyone can see all post on the feed
postRouter.get("/", postController.getAll);

// get following  users posts
postRouter.get(
  "/following-users",
  auth(USER_ROLE.USER),
  postController.getFollowingUsersPosts,
);

// get all current logged in user posts
postRouter.get(
  "/my-posts",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  postController.getLoggedInUserPosts,
);

// get single post by post slug (open to guests; full body for logged-in users)
postRouter.get(
  "/:slug",
  optionalAuth,
  postController.getSinglePost,
);

// delete a post by post id;
postRouter.delete(
  "/:id/by-admin",
  auth(USER_ROLE.ADMIN),
  postController.deletePostByAdminUsingId,
);

// delete a post by user using post id
postRouter.delete(
  "/:id",
  auth(USER_ROLE.USER),
  postController.deletePostByUserUsingId,
);

// update post by user using post id
postRouter.put(
  "/:id",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  multerUpload.single("image"),
  (req: Request, _res: Response, next: NextFunction) => {
    if (req.file?.path) {
      req.body.data = JSON.stringify({
        ...JSON.parse(req.body.data),
        coverImage: req.file.path,
      });
    }

    if (typeof req.body.data === "string" && req.body.data.trim()) {
      req.body = { ...JSON.parse(req.body.data) };
    } else {
      req.body = {};
    }

    next();
  },
  validateRequest(postValidationSchema.update),
  postController.updatePostByUserUsingId,
);

// update a post by admin
postRouter.put(
  "/:id/by-admin",
  auth(USER_ROLE.ADMIN),
  multerUpload.single("image"),
  (req: Request, _res: Response, next: NextFunction) => {
    if (req.file?.path) {
      req.body.data = JSON.stringify({
        ...JSON.parse(req.body.data),
        coverImage: req.file.path,
      });
    }

    if (typeof req.body.data === "string" && req.body.data.trim()) {
      req.body = { ...JSON.parse(req.body.data) };
    } else {
      req.body = {};
    }

    next();
  },
  validateRequest(postValidationSchema.updateByAdmin),
  postController.updatePostByAdmin,
);

// vote on post
postRouter.put(
  "/:id/vote",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  postController.voteOnPost,
);

// vote status
postRouter.get(
  "/:id/vote-status",
  auth(USER_ROLE.USER),
  postController.getVoteStatus,
);

// comment on a post
postRouter.post(
  "/:id/comments",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  multerUpload.array("images"),
  catchAsync((req: Request, _res: Response, next: NextFunction) => {
    if (req.files && req.files.length) {
      const imagePaths = (
        req.files as { fieldname: string; path: string }[]
      ).map((file) => file.path);

      req.body.data = JSON.stringify({
        ...JSON.parse(req.body.data || "{}"),
        images: imagePaths,
      });
    }

    if (typeof req.body.data === "string" && req.body.data.trim()) {
      req.body = { ...JSON.parse(req.body.data) };
    } else {
      req.body = {};
    }

    next();
  }),
  validateRequest(commentValidationSchema.commentOnPost),
  postController.commentOnPost,
);

// get all comments by post id
postRouter.get("/:id/comments", postController.getAllCommentsByPostId);

// get all posts by user id
postRouter.get("/users/:userId", postController.getAllPostsByUserId);

export default postRouter;
