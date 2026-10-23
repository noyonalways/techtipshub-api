import { z } from "zod";

const create = z.object({
  body: z
    .object({
      firstName: z
        .string({ error: "First name is required" })
        .trim()
        .min(1, "First name is required")
        .max(60, "First name is too long"),
      lastName: z
        .string({ error: "Last name is required" })
        .trim()
        .min(1, "Last name is required")
        .max(60, "Last name is too long"),
      email: z
        .string({ error: "Email is required" })
        .trim()
        .email("Please enter a valid email address")
        .max(254, "Email is too long"),
      subject: z
        .string({ error: "Subject is required" })
        .trim()
        .min(3, "Subject must be at least 3 characters")
        .max(150, "Subject is too long"),
      message: z
        .string({ error: "Message is required" })
        .trim()
        .min(10, "Message must be at least 10 characters")
        .max(5000, "Message is too long"),
    })
    .strict(),
});

const updateStatus = z.object({
  body: z
    .object({
      status: z.enum(["new", "read", "archived"], {
        error: "Status must be one of new, read, archived",
      }),
    })
    .strict(),
});

export const contactValidationSchema = {
  create,
  updateStatus,
};
