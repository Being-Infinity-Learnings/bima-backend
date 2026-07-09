// Purpose: Aggregate and export the socket module's public API for
// initializing the Socket.IO server and accessing manager/broadcast
// helpers.
const initializeSocket = require("./socket.server");
const socketManager = require("./socket.manager");
const socketBroadcast = require("./socket.broadcast");

module.exports = {
  initializeSocket,
  socketManager,
  socketBroadcast,
};
