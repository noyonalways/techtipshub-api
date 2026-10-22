import { z } from "zod";
import { SocialPlatform, UserGender } from "./user.constant";

const updateProfile = z.object({
  body: z
    .object({
      fullName: z.string({ error: "Full Name must be a string" }).optional(),
      bio: z.string({ error: "Bio must be a string" }).optional(),
      designation: z
        .string({ error: "Designation must be a string" })
        .optional(),
      phone: z.string({ error: "Phone must be a string" }).optional(),
      location: z.string({ error: "Location must be a string" }).optional(),
      dateOfBirth: z
        .string({ error: "Date of birth must be a string" })
        .optional(),
      gender: z
        .enum([...UserGender] as [string, ...string[]], {
          error: "Gender must be string",
        })
        .optional(),
      profilePicture: z
        .string({ error: "Profile picture must be a string" })
        .optional(),
    })
    .strict(),
});

const socialLinkSchema = z
  .object({
    platform: z.enum([...SocialPlatform] as [string, ...string[]], {
      error: "Social Platform must be string",
    }),
    url: z.string().url("Invalid URL"),
  })
  .optional();

const updateSocialLinks = z.object({
  body: z
    .object({
      socialLinks: z
        .array(socialLinkSchema)
        .min(1, "At least one social link is required")
        .max(6, "No more than 6 social links are allowed")
        .refine(
          (socialLinks) => {
            const platforms = socialLinks.map((link) => link?.platform);
            return new Set(platforms).size === platforms.length;
          },
          {
            message: "Social platforms must be unique",
          },
        )
        .optional(),
    })
    .strict(),
});

export const userValidationSchema = {
  updateProfile,
  updateSocialLinks,
};
