/**
 * Admin API. Everything here is mounted at `/api/v1/admin` and sits behind
 * `auth(USER_ROLE.ADMIN)`; the module routers keep only public/member routes.
 *
 * Query parameters are whitelisted per endpoint. An unknown value for an
 * enum-like one (`role`, `status`, `within`, blog `status`, `sort`) answers
 * 400; unknown keys are ignored. Every paged list returns
 * `meta: { page, limit, total, totalPages }`.
 *
 * Dashboard and audit
 *   GET    /admin/overview
 *   GET    /admin/search?q=
 *   GET    /admin/activity?days=
 *   GET    /admin/logs?limit=
 *   GET    /admin/metrics/dashboard
 *
 * Members
 *   GET    /admin/users?page=&limit=&sort=&role=&status=&searchTerm=
 *   GET    /admin/users/trash?page=&limit=&searchTerm=
 *   PATCH  /admin/users/:id/restore
 *   PATCH  /admin/users/:id/block
 *   PATCH  /admin/users/:id/unblock
 *   PATCH  /admin/users/:id/make-admin
 *   DELETE /admin/users/:id
 *
 * Blogs
 *   GET    /admin/blogs?page=&limit=&searchTerm=&category=&author=&sort=&status=
 *   GET    /admin/blogs/trash?page=&limit=&searchTerm=
 *   PATCH  /admin/blogs/:id/restore
 *   PUT    /admin/blogs/:id          (multipart: `image` + `data`)
 *   DELETE /admin/blogs/:id
 *
 * Categories
 *   GET    /admin/categories?searchTerm=&page=&limit=
 *   POST   /admin/categories
 *   PATCH  /admin/categories/:id
 *   DELETE /admin/categories/:id
 *
 * Comments
 *   GET    /admin/comments?page=&limit=&sort=&searchTerm=&within=&post=&user=
 *   GET    /admin/comments/latest
 *   GET    /admin/comments/counts
 *   DELETE /admin/comments/:id
 *
 * Messages (contact form)
 *   GET    /admin/messages?page=&limit=&sort=&status=&searchTerm=
 *   GET    /admin/messages/:id
 *   PATCH  /admin/messages/:id/status
 *
 * `GET /api/v1/metrics/dashboard` still exists for older callers.
 */
import { Router } from "express";
import { USER_ROLE } from "../../constant";
import { auth } from "../../middlewares";
import { metricsController } from "../metrics/metrics.controller";
import { adminController } from "./admin.controller";
import { adminBlogRouter, adminCategoryRouter } from "./admin.content.routes";
import {
  adminCommentRouter,
  adminMessageRouter,
  adminUserRouter,
} from "./admin.member.routes";

const adminRouter: Router = Router();

adminRouter.use(auth(USER_ROLE.ADMIN));

adminRouter.get("/overview", adminController.overview);
adminRouter.get("/search", adminController.search);
adminRouter.get("/activity", adminController.activity);
adminRouter.get("/logs", adminController.getLogs);
adminRouter.get("/metrics/dashboard", metricsController.dashboard);

adminRouter.use("/users", adminUserRouter);
adminRouter.use("/blogs", adminBlogRouter);
adminRouter.use("/categories", adminCategoryRouter);
adminRouter.use("/comments", adminCommentRouter);
adminRouter.use("/messages", adminMessageRouter);

export default adminRouter;
