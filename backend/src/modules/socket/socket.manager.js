// Purpose: Keep a reference to the Socket.IO server instance and map
// of connected sockets by user id for targeted emits.
let io = null;

const sockets = new Map();

// Set the Socket.IO server instance.
function setIO(instance) {
  io = instance;
}

// Return the Socket.IO server instance, or throw if not initialized.
function getIO() {
  if (!io) {
    throw new Error("Socket.IO has not been initialized.");
  }

  return io;
}

// Register a connected socket for a user id.
function registerSocket(userId, socket) {
  sockets.set(userId, socket);
}

// Unregister a user's socket (on disconnect).
function unregisterSocket(userId) {
  sockets.delete(userId);
}

// Return the socket instance for a given user id, or undefined.
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
