//This script is used to get a token for the test user.
//The token can be used to authenticate requests to the backend.

const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
require("dotenv").config();

// Web app's Firebase configuration loaded from environment variables.
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function main() {
  const credential = await signInWithEmailAndPassword(
    auth,
    "test@bima.com",
    "123456",
  );

  const token = await credential.user.getIdToken();

  console.log("\nTOKEN:\n");
  console.log(token);
}

main();
