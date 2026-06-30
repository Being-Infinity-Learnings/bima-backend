const { Server } = require("socket.io");

const authenticate = require("./socket.auth");
const registerEvents = require("./socket.events");
const socketManager = require("./socket.manager");

function initializeSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  socketManager.setIO(io);

  io.use(authenticate);

  io.on("connection", (socket) => {
    registerEvents(io, socket);
  });

  console.log("[Socket] Socket.IO initialized.");

  return io;
}

module.exports = initializeSocket;
