function registerSockets(io) {
  io.on("connection", (socket) => {
    socket.on("poll:join", ({ pollId, slug } = {}) => {
      if (pollId) socket.join(`poll:${pollId}`);
      if (slug) socket.join(`public:${slug}`);
    });

    socket.on("poll:leave", ({ pollId, slug } = {}) => {
      if (pollId) socket.leave(`poll:${pollId}`);
      if (slug) socket.leave(`public:${slug}`);
    });
  });
}

module.exports = registerSockets;
