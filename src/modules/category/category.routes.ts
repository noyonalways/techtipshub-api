import { Router } from "express";
import { categoryController } from "./category.controller";

const categoryRouter: Router = Router();

// Public reads only. Writes live under "/admin/categories".
categoryRouter.get("/", categoryController.getAll);

categoryRouter.get("/:id", categoryController.getSingleCategory);

export default categoryRouter;
