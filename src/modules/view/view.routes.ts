import { Router } from "express";
import { optionalAuth } from "../../middlewares";
import { viewController } from "./view.controller";

const viewRouter: Router = Router();

// Record a view for a post and return its fresh total. Open to guests as well
// as signed-in readers: optionalAuth only tells us who is asking.
viewRouter.post("/:slug", optionalAuth, viewController.recordPostView);

export default viewRouter;
