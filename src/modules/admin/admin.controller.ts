import httpStatus from "http-status";
import { catchAsync, sendResponse } from "../../utils";
import { adminService } from "./admin.service";

const overview = catchAsync(async (_req, res) => {
  const result = await adminService.overview();

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Admin overview retrieved successfully",
    data: result,
  });
});

const search = catchAsync(async (req, res) => {
  const result = await adminService.search(req.query.q);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Search results retrieved successfully",
    data: result,
  });
});

const activity = catchAsync(async (req, res) => {
  const result = await adminService.activity(req.query.days);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Activity retrieved successfully",
    data: result,
  });
});

const getLogs = catchAsync(async (req, res) => {
  const { result, meta } = await adminService.getLogs(req.query);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Activity log retrieved successfully",
    meta,
    data: result,
  });
});

export const adminController = {
  overview,
  search,
  activity,
  getLogs,
};
