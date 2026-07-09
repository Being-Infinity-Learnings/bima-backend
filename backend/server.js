require("dotenv").config();

const http = require("http");
const app = require("./src/app");

const { initializeSocket } = require("./src/modules/socket");

const PORT = process.env.PORT;

const server = http.createServer(app);

initializeSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});

const {
  dispatchPendingScheduled,
} = require("./src/modules/notifications/notification.service");

// Run scheduled notification dispatcher every minute
setInterval(() => {
  dispatchPendingScheduled().catch(console.error);
}, 60 * 1000);
