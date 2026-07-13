// Purpose: Redis connection(s). All app instances and worker processes
// must point at the SAME Redis for horizontal scaling to work — this is
// the shared state that replaces per-process memory.
//
// IMPORTANT: this module exports the plain app-traffic connection (used
// by runtime.store.js for GET/SET/HSET/ZADD/etc.) as the default export.
// BullMQ Queues/Workers must NOT reuse this same connection instance —
// a Worker issues blocking commands (BRPOPLPUSH-style) under the hood,
// and sharing a connection means those blocking calls can hold up or
// interleave badly with unrelated app commands riding the same socket.
// BullMQ's own docs recommend a dedicated connection per Queue/Worker.
// Use createBullConnection() (a fresh duplicate of the same Redis
// target) anywhere a Queue or Worker is constructed instead of importing
// this file directly.
const IORedis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

// maxRetriesPerRequest must be null for BullMQ's blocking connections,
// so we bake it into every connection this module hands out (both the
// shared app connection and any BullMQ duplicates).
function createConnection() {
  const conn = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  conn.on("error", (err) => {
    console.error("[Redis] Connection error:", err.message);
  });

  conn.on("connect", () => {
    console.log("[Redis] Connected.");
  });

  return conn;
}

// The single shared app-traffic connection (runtime.store.js, locks, etc).
const connection = createConnection();

// Call this once per BullMQ Queue/Worker instance to get its own
// dedicated connection instead of sharing `connection` above.
function createBullConnection() {
  return createConnection();
}

module.exports = connection;
module.exports.createBullConnection = createBullConnection;
