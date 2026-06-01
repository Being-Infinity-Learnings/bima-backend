const { z } = require("zod");

const registerProfileSchema = z.object({

    fullName: z.string().min(2),

    gender: z.string(),

    collegeName: z.string(),

    rollNumber: z.string()

});

module.exports = {
    registerProfileSchema
};