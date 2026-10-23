import httpStatus from "http-status";
import { catchAsync, sendResponse } from "../../utils";
import { contactService } from "./contact.service";
import type { TRouteParams } from "../../interface/params";

/**
 * Resolve the visitor's address for rate limiting.
 *
 * Behind a proxy (Vercel, Render, nginx) `req.ip` is the proxy's address, so
 * every visitor would share one bucket. Prefer the left-most
 * `X-Forwarded-For` entry, which is the originating client. Global
 * `trust proxy` is left untouched so other endpoints keep their behaviour.
 */
const resolveClientKey = (req: {
  ip?: string;
  headers: Record<string, unknown>;
}) => {
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

const getAll = catchAsync(async (req, res) => {
  const { result, meta, counts } = await contactService.getAll(req.query);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Contact messages retrieved successfully",
    meta,
    data: { result, meta, counts },
  });
});

const getSingle = catchAsync<TRouteParams>(async (req, res) => {
  const { id } = req.params;

  const result = await contactService.getSingle(id);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Contact message retrieved successfully",
    data: result,
  });
});

const updateStatus = catchAsync<TRouteParams>(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const result = await contactService.updateStatus(id, status, req.user.email);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Contact message status updated successfully",
    data: result,
  });
});

export const contactController = { create, getAll, getSingle, updateStatus };
