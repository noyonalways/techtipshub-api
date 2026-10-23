import httpStatus from "http-status";
import mongoose from "mongoose";
import { escapeRegex, parseSearchTerms, QueryBuilder } from "../../builder";
import { AppError } from "../../errors";
import { adminLogService } from "../admin/admin-log.service";
import Blog from "../blog/blog.model";
import { categorySearchableFields } from "./category.constant";
import { ICategory } from "./category.interface";
import Category from "./category.model";

type TCategoryInput = {
  name?: string;
  description?: string;
};

// Names are compared case-insensitively: "React" and "react" are one category.
const findByName = (name: string, excludeId?: string) =>
  Category.findOne({
    name: {
      $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      $options: "i",
    },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });

const create = async (payload: ICategory, adminEmail?: string) => {
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!name) {
    throw new AppError(httpStatus.BAD_REQUEST, "Category name is required");
  }

  if (await findByName(name)) {
    throw new AppError(httpStatus.CONFLICT, "Category already exists");
  }

  const category = await Category.create({
    name,
    description:
      typeof payload.description === "string" ? payload.description.trim() : "",
    postCount: 0,
  });

  await adminLogService.record({
    adminEmail,
    action: "category.create",
    targetType: "category",
    targetId: String(category._id),
    summary: `Created category "${category.name}"`,
  });

  return category;
};

const getAll = async (query: Record<string, unknown>) => {
  const categoryQuery = new QueryBuilder(Category.find({}), query).search(
    categorySearchableFields,
  );

  // Await the filter() method
  await categoryQuery.filter();

  // Now you can safely call sort, paginate, and fields
  categoryQuery.sort().paginate().fields();

  const result = await categoryQuery.modelQuery;
  const meta = await categoryQuery.countTotal();

  return { result, meta };
};

const getSingleCategory = async (id: string) => {
  const category = await Category.findById(id);
  if (!category) {
    throw new AppError(httpStatus.NOT_FOUND, "Category not found");
  }

  return category;
};

const deleteSingleCategory = async (id: string, adminEmail?: string) => {
  const category = await Category.findById(id);
  if (!category) {
    throw new AppError(httpStatus.NOT_FOUND, "Category not found");
  }

  const blogCount = await Blog.countDocuments({
    category: category._id,
    isDeleted: { $ne: true },
  });
  if (blogCount > 0) {
    throw new AppError(
      httpStatus.CONFLICT,
      `Category still has ${blogCount} published blogs. Move or delete them first.`,
    );
  }

  category.isDeleted = true;
  const result = await category.save();

  await adminLogService.record({
    adminEmail,
    action: "category.delete",
    targetType: "category",
    targetId: String(category._id),
    summary: `Deleted category "${category.name}"`,
  });

  return result;
};

const update = async (
  id: string,
  payload: TCategoryInput,
  adminEmail?: string,
) => {
  const updatePayload: Partial<TCategoryInput> = {};

  if (payload.name !== undefined) {
    updatePayload.name = payload.name.trim();
    if (!updatePayload.name) {
      throw new AppError(httpStatus.BAD_REQUEST, "Category name is required");
    }
  }

  if (payload.description !== undefined) {
    updatePayload.description = payload.description.trim();
  }

  const category = await Category.findById(id);
  if (!category) {
    throw new AppError(httpStatus.NOT_FOUND, "Category not found");
  }

  if (
    updatePayload.name &&
    (await findByName(updatePayload.name, String(category._id)))
  ) {
    throw new AppError(httpStatus.CONFLICT, "Category already exists");
  }

  const updated = await Category.findByIdAndUpdate(id, updatePayload, {
    new: true,
    runValidators: true,
  });

  await adminLogService.record({
    adminEmail,
    action: "category.update",
    targetType: "category",
    targetId: String(category._id),
    summary: `Updated category "${updated?.name ?? category.name}"`,
    meta: updatePayload,
  });

  return updated;
};

const getAdminList = async (query: Record<string, unknown> = {}) => {
  // Whitelisted and regex-escaped: `searchTerm` is expanded here, never
  // spliced into a Mongo filter as it arrived.
  const terms = parseSearchTerms(query.searchTerm);
  const search = terms.length
    ? {
        $and: terms.map((term) => {
          const escaped = escapeRegex(term);
          return {
            name: {
              $regex: escaped.length >= 3 ? `^${escaped}` : escaped,
              $options: "i",
            },
          };
        }),
      }
    : {};

  const categories = await Category.find(search).sort({ name: 1 });

  // Deleted blogs are excluded so the count matches what readers see.
  const counts = await Blog.aggregate<{
    _id: mongoose.Types.ObjectId;
    count: number;
  }>([
    { $match: { isDeleted: { $ne: true } } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);

  const countByCategory = new Map(
    counts.map((row) => [String(row._id), row.count]),
  );

  const rows = categories
    .map((category) => ({
      _id: category._id,
      name: category.name,
      description: category.description ?? "",
      blogCount: countByCategory.get(String(category._id)) ?? 0,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    }))
    .sort((a, b) => b.blogCount - a.blogCount || a.name.localeCompare(b.name));

  // Paging is opt-in: with neither `page` nor `limit` the whole list comes back
  // (the table is small), and `total` stays the number of matching categories.
  const rawPage = Math.trunc(Number(query.page));
  const rawLimit = Math.trunc(Number(query.limit));
  const total = rows.length;

  if (!(rawPage > 0) && !(rawLimit > 0)) {
    return { result: rows, total };
  }

  const page = Math.max(1, rawPage || 1);
  const limit = rawLimit > 0 ? Math.min(100, rawLimit) : 50;
  const start = (page - 1) * limit;

  return {
    result: rows.slice(start, start + limit),
    total,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const categoryService = {
  create,
  getAll,
  getSingleCategory,
  deleteSingleCategory,
  update,
  getAdminList,
};
