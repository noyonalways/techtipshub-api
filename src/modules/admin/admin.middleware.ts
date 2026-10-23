import { NextFunction, Request, Response, RequestHandler } from "express";
import { multerUpload } from "../../config/multer.config";
import { validateRequest } from "../../middlewares";
import { blogValidationSchema } from "../blog/blog.validation";

// Body parsing for admin blog writes. `coverImage` is only overwritten when a
// file actually arrives, so a JSON update keeps the stored image.
const parseBlogPayload = (req: Request, _res: Response, next: NextFunction) => {
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
};

// Update on PUT /admin/blogs/:id — same multipart contract as the old
// /blogs/:id/by-admin route.
export const updateBlogByAdminHandlers: RequestHandler[] = [
  multerUpload.single("image"),
  parseBlogPayload,
  validateRequest(blogValidationSchema.updateByAdmin),
];
