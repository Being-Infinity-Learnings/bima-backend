const { initializeApp } = require("firebase/app");
const {
  getAuth,
  signInWithEmailAndPassword
} = require("firebase/auth");

const firebaseConfig = {
  apiKey: "AIzaSyBWhPdUfmAWT2l89VBJRmGAQlNEFsR-oOg",
  authDomain: "bima-f83d5.firebaseapp.com",
  projectId: "bima-f83d5",
  storageBucket: "bima-f83d5.firebasestorage.app",
  messagingSenderId: "9986530081",
  appId: "1:9986530081:web:566c3ddcce20bea6857c60",
  measurementId: "G-5T83DF17CF"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function main() {

  const credential =
    await signInWithEmailAndPassword(
      auth,
      "test@bima.com",
      "123456"
    );

  const token =
    await credential.user.getIdToken();

  console.log("\nTOKEN:\n");
  console.log(token);
}

main();