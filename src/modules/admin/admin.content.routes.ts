import { Router } from "express";
import { validateRequest } from "../../middlewares";
import { blogController } from "../blog/blog.controller";
import { categoryController } from "../category/category.controller";
import { categoryValidationSchema } from "../category/category.validation";
import { updateBlogByAdminHandlers } from "./admin.middleware";

const adminBlogRouter: Router = Router();

// admin article table: page, limit, searchTerm, category, author, sort, status
adminBlogRouter.get("/", blogController.getAdminList);

// soft-deleted blogs, newest first
adminBlogRouter.get("/trash", blogController.getDeletedBlogs);

// restore a soft-deleted blog
adminBlogRouter.patch("/:id/restore", blogController.restoreBlog);

// remove a blog
adminBlogRouter.delete("/:id", blogController.deleteBlogByAdminUsingId);

// edit a blog (multipart `image` + `data`, same as the old by-admin route).
// The DELETE above wins over PUT on the same path, so one path serves both.
adminBlogRouter.put(
  "/:id",
  ...updateBlogByAdminHandlers,
  blogController.updateBlogByAdmin,
);

const adminCategoryRouter: Router = Router();

adminCategoryRouter.get("/", categoryController.getAdminList);

adminCategoryRouter.post(
  "/",
  validateRequest(categoryValidationSchema.create),
  categoryController.create,
);

adminCategoryRouter.patch(
  "/:id",
  validateRequest(categoryValidationSchema.update),
  categoryController.update,
);

adminCategoryRouter.delete(
  "/:id",
  validateRequest(categoryValidationSchema.deleteCategory),
  categoryController.deleteSingleCategory,
);

export { adminBlogRouter, adminCategoryRouter };
