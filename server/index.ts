import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import "dotenv/config";
import { configureSession, configureGoogleAuth } from "./auth";
import { registerRoutes } from "./routes";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Serve uploaded files (logos, etc.) — registered early so it is never caught
// by the SPA fallback or the API error handler.
const uploadsDir = path.resolve(__dirname, "..", "uploads");
app.use("/uploads", express.static(uploadsDir, { maxAge: "30d", immutable: true }));

// Keep the server alive even if an unexpected error slips through, so a single
// bad request can never take the whole app down.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err: any) => {
  if (err?.code === "EADDRINUSE") {
    console.error(
      `\n  Port ${PORT} is already in use — another copy of the app is still running.\n` +
      `  Close any other OST windows (or run stop-app.bat), then start again.\n`,
    );
    process.exit(1);
  }
  console.error("[uncaughtException]", err);
});

// Capture the raw request body alongside the parsed one — the Zoom webhook
// needs the exact raw bytes to verify its HMAC signature; re-serializing the
// parsed JSON wouldn't byte-match what Zoom actually signed.
app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

configureSession(app);
configureGoogleAuth(app);
registerRoutes(app);

async function start() {
  const server = createServer(app);

  if (process.env.NODE_ENV === "production") {
    const publicDir = path.resolve(__dirname, "public");
    app.use(express.static(publicDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(publicDir, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      root: path.resolve(__dirname, "..", "client"),
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `\n  Port ${PORT} is already in use — another copy of the app is still running.\n` +
        `  Close any other OST windows (or run stop-app.bat), then start again.\n`,
      );
      process.exit(1);
    }
    throw err;
  });

  server.listen(PORT, () => {
    console.log(`\n  OST All-in-One running at http://localhost:${PORT}\n`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
