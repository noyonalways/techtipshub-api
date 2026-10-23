import httpStatus from "http-status";
import { catchAsync, sendResponse } from "../../utils";
import { categoryService } from "./category.service";
import type { TRouteParams } from "../../interface/params";

const create = catchAsync(async (req, res) => {
  const result = await categoryService.create(req.body, req.user?.email);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Category created successfully",
    data: result,
  });
});

const getAll = catchAsync(async (req, res) => {
  const { meta, result } = await categoryService.getAll(req.query);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Categories retrieved successfully",
    data: result,
    meta,
  });
});

const getSingleCategory = catchAsync<TRouteParams>(async (req, res) => {
  const { id } = req.params;
  const result = await categoryService.getSingleCategory(id);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Category retrieved successfully",
    data: result,
  });
});

const deleteSingleCategory = catchAsync<TRouteParams>(async (req, res) => {
  const { id } = req.params;
  const result = await categoryService.deleteSingleCategory(
    id,
    req.user?.email,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Category deleted successfully",
    data: result,
  });
});

const update = catchAsync<TRouteParams>(async (req, res) => {
  const { id } = req.params;
  const result = await categoryService.update(id, req.body, req.user?.email);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Category updated successfully",
    data: result,
  });
});

const getAdminList = catchAsync(async (req, res) => {
  const { result, total, meta } = await categoryService.getAdminList(req.query);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Categories retrieved successfully",
    data: { result, total },
    meta,
  });
});

export const categoryController = {
  create,
  getAll,
  getSingleCategory,
  deleteSingleCategory,
  update,
  getAdminList,
};
