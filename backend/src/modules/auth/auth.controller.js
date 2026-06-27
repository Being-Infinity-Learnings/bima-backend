// HTTP handlers for authenticated user profile operations
// - `registerProfile` creates a profile for the currently authenticated Firebase user
// - `me` returns the authenticated user's database profile

const { Prisma } = require("@prisma/client");

const {
  registerProfileSchema,
  updateProfileSchema,
} = require("./auth.validation");

const authService = require("./auth.service");

// Handler: registerProfile(req, res)
// - Validates the request body and creates or returns an existing
//   profile for the authenticated Firebase user.
async function registerProfile(req, res) {
  try {
    const validated = registerProfileSchema.parse(req.body);

    const firebaseUser = req.user;

    const user = await authService.createUserProfile({
      firebaseUid: firebaseUser.uid,

      email: validated.email,

      phone: firebaseUser.phone_number,

      fullName: validated.fullName,
      gender: validated.gender,
      collegeName: validated.collegeName,
      rollNumber: validated.rollNumber,
    });

    return res.status(201).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error(error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const field = error.meta?.target?.[0];

      let message = "A record already exists.";

      switch (field) {
        case "email":
          message = "A user with this email already exists.";
          break;

        case "phone":
          message = "A user with this phone number already exists.";
          break;

        case "rollNumber":
          message = "This roll number is already registered.";
          break;

        case "firebaseUid":
          message = "This account is already registered.";
          break;
      }

      return res.status(409).json({
        success: false,
        error: message,
      });
    }

    return res.status(400).json({
      success: false,
      error: "Unable to complete registration.",
    });
  }
}

//   Handler: me(req, res)
// - Returns the database profile attached by the `authenticate` middleware as `req.dbUser`.
async function me(req, res) {
  try {
    const firebaseUid = req.user.uid;

    const user = req.dbUser;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function updateProfile(req, res) {
  try {
    const validated = updateProfileSchema.parse(req.body);

    const firebaseUid = req.user.uid;

    const updatedUser = await authService.updateUserProfile(
      firebaseUid,
      validated,
    );

    return res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    console.error(error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const field = error.meta?.target?.[0];

      let message = "A record already exists.";

      switch (field) {
        case "email":
          message = "A user with this email already exists.";
          break;

        case "phone":
          message = "A user with this phone number already exists.";
          break;

        case "rollNumber":
          message = "This roll number is already registered.";
          break;
      }

      return res.status(409).json({
        success: false,
        error: message,
      });
    }

    return res.status(400).json({
      success: false,
      error: "Unable to update profile.",
    });
  }
}

module.exports = {
  registerProfile,
  me,
  updateProfile,
};
