import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";
import { getDb, initializeSchema, getUserByOpenId } from "../db";
import { restoreFromDb, setOwnerUserId } from "../paperTrading";
import { initWebSocketServer } from "../wsPriceFeed";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Initialize SQLite database and schema
  try {
    await getDb();
    await initializeSchema();
    console.log('[Database] SQLite schema initialized');
  } catch (err) {
    console.error('[Database] Failed to initialize:', err);
  }

  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Initialize WebSocket price feed
  initWebSocketServer(server);

  server.listen(port, async () => {
    console.log(`Server running on http://localhost:${port}/`);

    // Auto-restore paper trading state for the owner
    try {
      if (ENV.ownerOpenId) {
        const owner = await getUserByOpenId(ENV.ownerOpenId);
        if (owner) {
          setOwnerUserId(owner.id);
          const restored = await restoreFromDb(owner.id);
          if (restored) {
            console.log('[Startup] Paper trading state restored from DB');
          } else {
            console.log('[Startup] No saved paper trading state found — starting fresh');
          }
        }
      }
    } catch (err) {
      console.error('[Startup] Failed to restore paper trading state:', err);
    }
  });
}

startServer().catch(console.error);
