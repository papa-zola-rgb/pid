// const { Server } = require("socket.io"); // <--- Tambahkan baris ini!

let io;

module.exports = {
  init: (server) => {
    if (!io) {
      io = new Server(server, {
        cors: { origin: "http://localhost:3000", methods: ["GET", "POST"] },
      });
    }
    return io;
  },
  getIO: () => {
    if (!io) throw new Error("Socket.io not initialized!");
    return io;
  },
};
