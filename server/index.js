const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const { Server } = require("socket.io");
const env = require("./config/env");
const { closeDb } = require("./db/client");
const { initializeDatabase } = require("./db/init");
const { attachUser } = require("./middleware/auth");
const { initRedis, apiLimiter } = require("./middleware/rateLimit");
const authRoutes = require("./routes/auth");
const pollRoutes = require("./routes/polls");
const publicPollRoutes = require("./routes/publicPolls");
const registerSockets = require("./sockets");

async function main() {
  await initializeDatabase();
  await initRedis();

  const app = express();
  app.set("trust proxy", 1);
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: env.clientUrl,
      credentials: true
    }
  });

  app.set("io", io);
  registerSockets(io);

  app.use(
    helmet({
      contentSecurityPolicy: env.isProduction ? undefined : false
    })
  );
  app.use(
    cors({
    origin: [env.clientUrl],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
    })
  );
  app.use(morgan(env.isProduction ? "combined" : "dev"));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(attachUser);
  app.use("/api", apiLimiter());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "pollpulse", time: new Date().toISOString() });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/polls", pollRoutes);
  app.use("/api/public/polls", publicPollRoutes);

  const distPath = path.resolve(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("/{*splat}", (_req, res, next) => {
    if (env.nodeEnv !== "production") return next();
    return res.sendFile(path.join(distPath, "index.html"));
  });

  app.use((req, res) => {
    res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
  });

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(error.status || 500).json({
      message: error.message || "Something went wrong."
    });
  });

  server.listen(env.port, () => {
    console.log(`PollPulse API listening on http://localhost:${env.port}`);
  });

  const shutdown = async () => {
    await closeDb();
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
