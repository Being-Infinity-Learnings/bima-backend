//This script is used to get a token for the test user.
//The token can be used to authenticate requests to the backend.

const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
require("dotenv").config();

//Web app's Firebase configuration
const firebaseConfig = require("../config/firebaseWebConfig.json");

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
