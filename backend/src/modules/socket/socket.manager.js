// Purpose: Keep a reference to the Socket.IO server instance.
//
// NOTE: the local `Map<userId, socket>` this module used to hold for
// per-user targeting has been removed. It only worked for sockets
// connected to the SAME process, which breaks the moment you run more
// than one instance. Per-user targeting is now done via Socket.IO rooms
// (every socket joins `user:{userId}` on connect — see socket.server.js)
// combined with the Redis adapter, which makes `io.to(room).emit(...)`
// reach the right socket regardless of which instance it's connected to.
let io = null;

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

module.exports = {
  setIO,
  getIO,
};
