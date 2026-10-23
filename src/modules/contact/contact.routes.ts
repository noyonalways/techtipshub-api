import { Router } from "express";
import { validateRequest } from "../../middlewares";
import { contactController } from "./contact.controller";
import { contactValidationSchema } from "./contact.validation";

const contactRoutes: Router = Router();

// Public contact form. Inbox handling lives under "/admin/messages".
contactRoutes.post(
  "/",
  validateRequest(contactValidationSchema.create),
  contactController.create,
);

export default contactRoutes;
