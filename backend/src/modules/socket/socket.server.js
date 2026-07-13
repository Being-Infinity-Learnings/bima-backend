// Purpose: Initialize Socket.IO server, install the Redis adapter (so
// broadcasts/rooms work across every horizontally-scaled instance),
// install authentication, and register event handlers for incoming
// socket connections.
const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");

const authenticate = require("./socket.auth");
const registerEvents = require("./socket.events");
const socketManager = require("./socket.manager");

// Initialize the Socket.IO server, wire up the Redis adapter, and
// register middleware/events.
async function initializeSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Without this, io.to(room).emit(...) and io.in(room).emit(...) only
  // reach sockets connected to THIS process. With it, every instance's
  // emit is published over Redis pub/sub and delivered to sockets
  // connected to any instance in the cluster.
  const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();

  pubClient.on("error", (err) =>
    console.error("[Socket/Redis pub] error:", err.message),
  );
  subClient.on("error", (err) =>
    console.error("[Socket/Redis sub] error:", err.message),
  );

  await Promise.all([pubClient.connect(), subClient.connect()]);

  io.adapter(createAdapter(pubClient, subClient));

  socketManager.setIO(io);

  io.use(authenticate);

  io.on("connection", (socket) => {
    // Every socket joins a personal room named after its user id. This
    // is how we now target an individual user (e.g. per-user question
    // results) instead of a process-local `Map<userId, socket>` — a room
    // works across the whole cluster via the adapter above, a local Map
    // does not.
    socket.join(`user:${socket.dbUser.id}`);

    registerEvents(io, socket);
  });

  console.log("[Socket] Socket.IO initialized with Redis adapter.");

  return io;
}

module.exports = initializeSocket;
