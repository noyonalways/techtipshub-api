import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../utils";
import type { ZodType } from "zod";

const validateRequest = (schema: ZodType) => {
  return catchAsync(
    async (req: Request, _res: Response, next: NextFunction) => {
      // Zod 4 removed the `AnyZodObject` alias; any ZodType accepts parseAsync.
      await schema.parseAsync({
        body: req.body,
        cookies: req.cookies,
      });

      next();
    },
  );
};

export default validateRequest;
