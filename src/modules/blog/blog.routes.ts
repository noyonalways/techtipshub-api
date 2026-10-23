import { NextFunction, Request, Response, Router } from "express";
import { multerUpload } from "../../config/multer.config";
import { USER_ROLE } from "../../constant";
import { auth, optionalAuth, validateRequest } from "../../middlewares";
import { catchAsync } from "../../utils";
import { commentValidationSchema } from "../comment/comment.validation";
import { blogController } from "./blog.controller";
import { blogValidationSchema } from "./blog.validation";

const blogRouter: Router = Router();

// write a blog
blogRouter.post(
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
  validateRequest(blogValidationSchema.create),
  blogController.create,
);

// anyone can see all blogs on the feed
blogRouter.get("/", blogController.getAll);

// get following users blogs
blogRouter.get(
  "/following-users",
  auth(USER_ROLE.USER),
  blogController.getFollowingUsersBlogs,
);

// get all current logged in user blogs
blogRouter.get(
  "/my-blogs",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  blogController.getLoggedInUserBlogs,
);

// soft-deleted blogs, restore, forced delete and admin edits live under
// "/admin/blogs".

// get single blog by blog slug (open to guests; full body for logged-in users)
blogRouter.get("/:slug", optionalAuth, blogController.getSingleBlog);

// delete a blog by user using blog id
blogRouter.delete(
  "/:id",
  auth(USER_ROLE.USER),
  blogController.deleteBlogByUserUsingId,
);

// update blog by user using blog id
blogRouter.put(
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
  validateRequest(blogValidationSchema.update),
  blogController.updateBlogByUserUsingId,
);

// vote on blog
blogRouter.put(
  "/:id/vote",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  blogController.voteOnBlog,
);

// vote status
blogRouter.get(
  "/:id/vote-status",
  auth(USER_ROLE.USER),
  blogController.getVoteStatus,
);

// comment on a blog
blogRouter.post(
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
  validateRequest(commentValidationSchema.commentOnBlog),
  blogController.commentOnBlog,
);

// get all comments by blog id
blogRouter.get("/:id/comments", blogController.getAllCommentsByBlogId);

// get all blogs by user id
blogRouter.get("/users/:userId", blogController.getAllBlogsByUserId);

export default blogRouter;
