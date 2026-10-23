import { Router } from "express";
import { validateRequest } from "../../middlewares";
import { commentController } from "../comment/comment.controller";
import { contactController } from "../contact/contact.controller";
import { contactValidationSchema } from "../contact/contact.validation";
import { userController } from "../user/user.controller";
import { adminCommentController } from "./admin.comment.controller";

const adminUserRouter: Router = Router();

adminUserRouter.get("/", userController.getAllUsers);

// Literal path before "/:id" routes.
adminUserRouter.get("/trash", userController.getDeletedUsers);

adminUserRouter.patch("/:id/restore", userController.restoreUser);
adminUserRouter.patch("/:id/block", userController.blockUser);
adminUserRouter.patch("/:id/unblock", userController.unBlockUser);
adminUserRouter.patch("/:id/make-admin", userController.makeAdmin);
adminUserRouter.delete("/:id", userController.deleteUserAccount);

const adminCommentRouter: Router = Router();

// Literal paths must stay above "/:id".
adminCommentRouter.get("/", commentController.getAll);
adminCommentRouter.get("/latest", commentController.getLatest);
adminCommentRouter.get("/counts", commentController.getCounts);

adminCommentRouter.delete("/:id", adminCommentController.deleteComment);

const adminMessageRouter: Router = Router();

adminMessageRouter.get("/", contactController.getAll);
adminMessageRouter.get("/:id", contactController.getSingle);
adminMessageRouter.patch(
  "/:id/status",
  validateRequest(contactValidationSchema.updateStatus),
  contactController.updateStatus,
);

export { adminUserRouter, adminCommentRouter, adminMessageRouter };
