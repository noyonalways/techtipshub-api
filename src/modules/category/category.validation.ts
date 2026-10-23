import { z } from "zod";

const create = z.object({
  body: z
    .object({
      name: z
        .string({ error: "Name must be a string" })
        .min(1, "Category name must be at least one character"),
      description: z
        .string({ error: "Description must be a string" })
        .min(1, "Description must be at least one character")
        .optional(),
    })
    .strict(),
});

const update = z.object({
  body: z
    .object({
      name: z
        .string({ error: "Name must be a string" })
        .min(1, "Category name must be at least one character")
        .optional(),
      description: z
        .string({ error: "Description must be a string" })
        .min(1, "Description must be at least one character")
        .optional(),
    })
    .strict(),
});

/**
 * Admin delete changes nothing the caller supplies, so the body is left alone;
 * the schema exists so the route reports invalid bodies like its siblings do.
 */
const deleteCategory = z.object({
  body: z.object({}).passthrough(),
});

export const categoryValidationSchema = {
  create,
  update,
  deleteCategory,
};
