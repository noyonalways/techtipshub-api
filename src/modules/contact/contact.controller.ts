import httpStatus from "http-status";
import { catchAsync, sendResponse } from "../../utils";
import { contactService } from "./contact.service";

/**
 * Resolve the visitor's address for rate limiting.
 *
 * Behind a proxy (Vercel, Render, nginx) `req.ip` is the proxy's address, so
 * every visitor would share one bucket. Prefer the left-most
 * `X-Forwarded-For` entry, which is the originating client. Global
 * `trust proxy` is left untouched so other endpoints keep their behaviour.
 */
const resolveClientKey = (req: { ip?: string; headers: Record<string, unknown> }) => {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.trim()) {
    // client, proxy1, proxy2 -> client
    return forwarded.split(",")[0].trim();
  }

  return req.ip || "unknown";
};

const create = catchAsync(async (req, res) => {
  const result = await contactService.create(req.body, resolveClientKey(req));

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Your message has been sent",
    data: result,
  });
});

export const contactController = { create };
