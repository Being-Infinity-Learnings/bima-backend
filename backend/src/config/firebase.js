// Purpose: Initialize and export the Firebase Admin SDK instance.
// This module loads the service account key from environment variables and
// configures the Admin SDK so other modules can verify ID tokens and manage
// Firebase Authentication programmatically.

require("dotenv").config();
const admin = require("firebase-admin");

// Load-test only: loadtest/broadcast boots the REAL server to test
// Socket.IO connection/broadcast scaling, but every connection in that
// suite authenticates through socket.auth.js's loadtest bypass, never
// through real Firebase — so there's no reason to require real
// service-account credentials just to let the process boot. Gated by the
// same NODE_ENV backstop plus flag as that bypass (see socket.auth.js);
// if anything unexpectedly calls `admin.auth()`/`admin.messaging()` while
// this is set, it fails fast with Firebase's own "no default app" error
// rather than silently doing something wrong — nothing in the broadcast
// suite's scope does.
if (
  process.env.NODE_ENV !== "production" &&
  process.env.LOADTEST_AUTH_BYPASS === "true"
) {
  module.exports = admin;
} else {
  const serviceAccount = {
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  module.exports = admin;
}
