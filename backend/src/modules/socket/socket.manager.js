let io = null;

const sockets = new Map();

function setIO(instance) {
  io = instance;
}

function getIO() {
  if (!io) {
    throw new Error("Socket.IO has not been initialized.");
  }

  return io;
}

function registerSocket(userId, socket) {
  sockets.set(userId, socket);
}

function unregisterSocket(userId) {
  sockets.delete(userId);
}

function getSocket(userId) {
  return sockets.get(userId);
}

module.exports = {
  setIO,
  getIO,
  registerSocket,
  unregisterSocket,
  getSocket,
};
