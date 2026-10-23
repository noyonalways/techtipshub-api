import { NextFunction, Request, Response } from "express";
import type { RequestHandler } from "express";

/**
 * Wraps a route handler so rejected promises reach the Express error handler.
 *
 * It is generic over the handler's Request so any param/body/query typing
 * declared on the handler is preserved. This matters on Express 5, where
 * `req.params` values are `string | string[]`; a route typed as
 * `Request<{ id: string }>` keeps `id` as a plain `string` inside the handler.
 */
const catchAsync = <
  P = Request["params"],
  ResBody = unknown,
  ReqBody = Request["body"],
  ReqQuery = Request["query"],
>(
  fn: (
    req: Request<P, ResBody, ReqBody, ReqQuery>,
    res: Response<ResBody>,
    next: NextFunction,
  ) => unknown,
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as never, res as never, next)).catch((err) =>
      next(err),
    );
  };
};

export default catchAsync;
