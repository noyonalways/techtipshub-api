import { Router } from "express";
import { validateRequest } from "../../middlewares";
import { contactController } from "./contact.controller";
import { contactValidationSchema } from "./contact.validation";

const contactRoutes: Router = Router();

contactRoutes
  .route("/")
  .post(
    validateRequest(contactValidationSchema.create),
    contactController.create,
  );

export default contactRoutes;
