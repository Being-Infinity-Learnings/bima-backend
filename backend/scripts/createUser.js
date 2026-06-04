// This script is used to create a test user in Firebase Authentication.
// The user can be used to authenticate requests to the backend.

const admin = require("../src/config/firebase");

async function createUser() {
  const user = await admin.auth().createUser({
    email: "student3@bima.com",

    password: "123456",
  });

  console.log(user);
}

createUser();
