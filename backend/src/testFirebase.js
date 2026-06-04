const admin = require("./config/firebase");

async function testFirebase() {
    try {
        const users = await admin.auth().listUsers(1);

        console.log("Firebase Connected Successfully");
        console.log(users.users.length);
    }
    catch(error) {
        console.error(error);
    }
}

testFirebase();