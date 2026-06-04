// Purpose: Initialize and export the Firebase Admin SDK instance.
// This module loads the service account key and configures the
// Admin SDK so other modules can verify ID tokens and manage
// Firebase Authentication programmatically.

const admin = require("firebase-admin");

const serviceAccount = require("../../config/serviceAccountKey.json");

// Initialize Firebase Admin SDK using service account credentials.
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
