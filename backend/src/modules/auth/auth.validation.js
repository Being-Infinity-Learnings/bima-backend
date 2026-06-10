// Request validation schemas (Zod) for auth module endpoints.
// Exports `registerProfileSchema` used by `auth.controller.registerProfile`.

const { z } = require("zod");

const registerProfileSchema = z.object({
  fullName: z.string().min(2),
  gender: z.string(),
  collegeName: z.string(),
  rollNumber: z.string(),
  email: z.string().email("Invalid email address"),
});

const updateProfileSchema = z.object({
  fullName: z.string().min(2).optional(),
  gender: z.string().optional(),
  collegeName: z.string().optional(),
  rollNumber: z.string().optional(),
  email: z.string().email("Invalid email address").optional(),
});

module.exports = {
  registerProfileSchema,
  updateProfileSchema,
};
