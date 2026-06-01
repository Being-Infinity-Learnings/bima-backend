const admin = require("../src/config/firebase");

async function createUser() {
  const user = await admin.auth().createUser({
    email: "student1@bima.com",

    password: "123456",
  });

  console.log(user);
}

createUser();
