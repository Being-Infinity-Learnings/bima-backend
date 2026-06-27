require("dotenv").config();

const app = require("./src/app");

const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});

const {
  dispatchPendingScheduled,
} = require("./src/modules/notifications/notification.service");

// Run scheduled notification dispatcher every minute
setInterval(() => {
  dispatchPendingScheduled().catch(console.error);
}, 60 * 1000);
