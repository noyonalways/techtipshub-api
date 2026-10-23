import { NextFunction, Request, Response, Router } from "express";
import { multerUpload } from "../../config/multer.config";
import { USER_ROLE } from "../../constant";
import { auth, validateRequest } from "../../middlewares";
import { catchAsync } from "../../utils";
import { commentController } from "./comment.controller";
import { commentValidationSchema } from "./comment.validation";

const commentRouter: Router = Router();

// Listing and moderation live under "/admin/comments".

commentRouter.delete(
  "/:id",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  commentController.deleteComment,
);

commentRouter.put(
  "/:id",
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
  validateRequest(commentValidationSchema.updateComment),
  commentController.updateComment,
);

export default commentRouter;
