require("dotenv").config();

const http = require("http");
const app = require("./src/app");

const { initializeSocket } = require("./src/modules/socket");

// Start consuming BullMQ jobs for automatic quiz start (quiz-start) and
// phase progression (quiz-phase).
require("./src/modules/runtime/runtime.worker");

const PORT = process.env.PORT;

const server = http.createServer(app);

async function start() {
  // initializeSocket is now async (it connects the Redis pub/sub clients
  // used by the Socket.IO Redis adapter) so we must await it before the
  // server starts accepting connections.
  await initializeSocket(server);

  server.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
  });
}

start().catch((err) => {
  console.error("[Server] Failed to start:", err);
  process.exit(1);
});

const {
  dispatchPendingScheduled,
} = require("./src/modules/notifications/notification.service");

// Run scheduled notification dispatcher every minute
setInterval(() => {
  dispatchPendingScheduled().catch(console.error);
}, 60 * 1000);
