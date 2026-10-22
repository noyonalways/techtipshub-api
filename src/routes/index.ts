import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import categoryRoutes from "../modules/category/category.routes";
import commentRoutes from "../modules/comment/comment.routes";
import contactRoutes from "../modules/contact/contact.routes";
import metricsRoutes from "../modules/metrics/metrics.routes";
import postRoutes from "../modules/post/post.routes";
import userRoutes from "../modules/user/user.routes";
import viewRoutes from "../modules/view/view.routes";

const router: Router = Router();

const moduleRoutes = [
  {
    path: "/auth",
    routes: authRoutes,
  },
  {
    path: "/users",
    routes: userRoutes,
  },
  {
    path: "/categories",
    routes: categoryRoutes,
  },
  {
    path: "/posts",
    routes: postRoutes,
  },
  {
    path: "/comments",
    routes: commentRoutes,
  },
  {
    path: "/metrics",
    routes: metricsRoutes,
  },
  {
    path: "/contact",
    routes: contactRoutes,
  },
  {
    // Unique-reader view counting for guests and signed-in readers alike.
    path: "/views",
    routes: viewRoutes,
  },
];

moduleRoutes.forEach(({ path, routes }) => {
  router.use(path, routes);
});

export default router;
