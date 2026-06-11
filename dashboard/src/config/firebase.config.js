/**
 * Firebase configuration
 * Replace with your actual Firebase project credentials.
 * These values come from: Firebase Console → Project Settings → Your apps
 *
 * You can also set them via environment variables in .env:
 *   VITE_FIREBASE_API_KEY=...
 *   VITE_FIREBASE_AUTH_DOMAIN=...
 *   etc.
 */
import { initializeApp } from "firebase/app";
import { getAuth, RecaptchaVerifier } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Creates an invisible reCAPTCHA verifier bound to the given container element ID.
// Call this once before sending an OTP. Pass the returned verifier to sendOtp().
// Re-create it on every new OTP attempt to avoid "already rendered" errors.
export function createRecaptchaVerifier(containerId = "recaptcha-container") {
  return new RecaptchaVerifier(auth, containerId, { size: "invisible" });
}

export default app;
