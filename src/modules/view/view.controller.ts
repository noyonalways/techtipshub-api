import { createHash } from "crypto";
import { Request } from "express";
import httpStatus from "http-status";
import { catchAsync, sendResponse } from "../../utils";
import { recordView } from "./view.service";

/**
 * Derive a pseudonymous key for a guest reader.
 *
 * The client sends a random id kept in a cookie (`visitorId`). Combined with a
 * salted hash of the IP address and user agent it is stable for one reader on
 * one device and changes when any of those change, which is the right scope
 * for "unique views". Only the SHA-256 digest is stored, never the IP itself.
 */
const guestVisitorKey = (req: Request): string | undefined => {
  const body = req.body as { visitorId?: unknown } | undefined;
  const visitorId =
    typeof body?.visitorId === "string" ? body.visitorId.slice(0, 64) : "";
  if (!visitorId) return undefined;

  const forwarded = req.headers["x-forwarded-for"];
  const firstForwarded = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(",")[0];
  const ip = firstForwarded?.trim() || req.socket?.remoteAddress || "unknown";
  const userAgent = String(req.headers["user-agent"] || "unknown");
  const salt = process.env.JWT_ACCESS_TOKEN_SECRET || "techtipshub";

  return createHash("sha256")
    .update(`${visitorId}|${ip}|${userAgent}|${salt}`)
    .digest("hex");
};

const recordBlogView = catchAsync(async (req, res) => {
  const slug = String(req.params.slug);

  const totalViews = await recordView(slug, {
    user: req.user,
    visitorKey: req.user ? undefined : guestVisitorKey(req),
  });

  if (totalViews === null) {
    sendResponse(res, {
      success: false,
      statusCode: httpStatus.NOT_FOUND,
      message: "Blog not found",
      data: null,
    });
    return;
  }

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "View recorded",
    data: { totalViews },
  });
});

export const viewController = {
  recordBlogView,
};
