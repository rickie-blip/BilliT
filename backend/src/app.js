import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { PORT } from "./config/env.js";
import { dataFile, distDirectory, usersFile } from "./config/paths.js";
import { ensureDataStore } from "./data/store.js";
import { ensureUsersStore } from "./data/users.js";
import { handleApiRequest } from "./handlers/api.js";
import { startAutomationJobs } from "./services/automation.js";
import { sendJson } from "./utils/http.js";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript",
  ".mjs":  "application/javascript",
  ".css":  "text/css",
  ".json": "application/json",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".txt":  "text/plain",
};

const serveStatic = (req, res) => {
  const urlPath = new URL(req.url, "http://localhost").pathname;
  const ext = path.extname(urlPath).toLowerCase();

  // Resolve the file — default to index.html for SPA routes
  let filePath = path.join(distDirectory, urlPath);

  if (!ext || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = path.join(distDirectory, "index.html");
  }

  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const mime = MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": mime });
  createReadStream(filePath).pipe(res);
};

const hasDist = () => existsSync(path.join(distDirectory, "index.html"));

export const startServer = async () => {
  await ensureDataStore();
  await ensureUsersStore();

  startAutomationJobs();

  if (hasDist()) {
    console.log(`Serving frontend from ${distDirectory}`);
  } else {
    console.log("No frontend dist found — API-only mode");
  }

  const server = createServer(async (req, res) => {
    try {
      const url = req.url || "/";

      // All /api/* requests go to the API handler
      if (url.startsWith("/api")) {
        await handleApiRequest(req, res);
        return;
      }

      // Serve static frontend if dist exists, otherwise 404
      if (hasDist()) {
        serveStatic(req, res);
      } else {
        sendJson(res, 404, { message: "Not found" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal server error";
      sendJson(res, 500, { message });
    }
  });

  server.listen(PORT, () => {
    console.log(`BillIT running on http://localhost:${PORT}`);
    console.log(`Store: ${dataFile}`);
    console.log(`Users: ${usersFile}`);
  });

  return server;
};
