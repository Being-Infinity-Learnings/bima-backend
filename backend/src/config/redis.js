// Purpose: Single shared Redis connection (via ioredis) used by BullMQ
// queues/workers and by the runtime store. All app instances and worker
// processes must point at the SAME Redis for horizontal scaling to work —
// this is the shared state that replaces per-process memory.
const IORedis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

// maxRetriesPerRequest must be null for BullMQ's blocking connections.
const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

connection.on("error", (err) => {
  console.error("[Redis] Connection error:", err.message);
});

connection.on("connect", () => {
  console.log("[Redis] Connected.");
});

module.exports = connection;
