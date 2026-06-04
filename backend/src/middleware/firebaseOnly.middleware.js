// This file Verifies incoming requests by validating the Firebase ID token
// and attaching only the Firebase token only to the 
// This is for the special case when a user registeres there profile for the first time

const admin = require("../config/firebase");

async function authenticateFirebaseOnly(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization header missing",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = await admin.auth().verifyIdToken(token);

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = authenticateFirebaseOnly;
