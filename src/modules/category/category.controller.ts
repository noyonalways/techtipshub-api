import httpStatus from "http-status";
import { catchAsync, sendResponse } from "../../utils";
import { categoryService } from "./category.service";
import type { TRouteParams } from "../../interface/params";

const create = catchAsync(async (req, res) => {
  const result = await categoryService.create(req.body);

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
  const result = await categoryService.deleteSingleCategory(id);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Category deleted successfully",
    data: result,
  });
});

export const categoryController = {
  create,
  getAll,
  getSingleCategory,
  deleteSingleCategory,
};
