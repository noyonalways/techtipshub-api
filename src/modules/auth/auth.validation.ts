import { z } from "zod";
import { UserGender } from "../user/user.constant";

const register = z.object({
  body: z
    .object({
      fullName: z.string({ error: "Full Name must be string" }),
      username: z.string({ error: "Username must be string" }),
      email: z.string({ error: "Email must be string" }),
      password: z.string({ error: "Password must be string" }),
      gender: z.enum([...UserGender] as [string, ...string[]], {
        error: "Gender must be string",
      }),
      dateOfBirth: z
        .string({ error: "Date of Birth must be string" })
        .date("Invalid Date, Expected format: YYYY-MM-DD"),
      profilePicture: z
        .string({ error: "Profile Picture must be string" })
        .optional(),
    })
    .strict(),
});

const login = z.object({
  body: z
    .object({
      email: z.string({ error: "Email must be string" }),
      password: z.string({ error: "Password must be string" }),
    })
    .strict(),
});

const socialLogin = z.object({
  body: z
    .object({
      fullName: z.string({ error: "Full Name must be a string" }),
      email: z
        .string({ error: "Email must be a string" })
        .email("Provide a valid email address"),
      profilePicture: z
        .string({ error: "Profile Picture must be a string" })
        .optional(),
    })
    .strict(),
});

const changePassword = z.object({
  body: z
    .object({
      oldPassword: z.string({ error: "Old password must be a string" }),
      newPassword: z
        .string({ error: "New password must be a string" })
        .min(6, "New password must be at least 8 characters"),
    })
    .strict(),
});

const forgetPassword = z.object({
  body: z
    .object({
      email: z.string({ error: "Email must be a string" }),
    })
    .strict(),
});

const resetPassword = z.object({
  body: z
    .object({
      email: z.string({ error: "Email must be a string" }),
      newPassword: z
        .string({ error: "New password must be a string" })
        .min(6, "New password must be at least 8 characters"),
    })
    .strict(),
});

const refreshToken = z.object({
  cookies: z
    .object({
      refreshToken: z.string({ error: "Refresh token must be a string" }),
    })
    .strict(),
});

export const authValidationSchema = {
  register,
  login,
  socialLogin,
  changePassword,
  forgetPassword,
  resetPassword,
  refreshToken,
};
