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

module.exports = {
  registerProfileSchema,
};
