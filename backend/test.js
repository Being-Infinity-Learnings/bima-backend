const admin = require("./src/config/firebase");

async function test() {
  try {
    const result = await admin.messaging().send({
      topic: "test",
      notification: {
        title: "Hello",
        body: "Test",
      },
    });

    console.log("SUCCESS", result);
  } catch (err) {
    console.error(err);
  }
}

test();
