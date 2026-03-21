import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const rootDir = resolve("/app/dist");
const indexPath = join(rootDir, "index.html");
const port = Number.parseInt(process.env.PORT ?? "8080", 10);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const assetExtensions = new Set([
  ".css",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".js",
  ".map",
  ".png",
  ".svg",
  ".woff",
  ".woff2",
]);

function safePathname(urlPathname) {
  try {
    const decoded = decodeURIComponent(urlPathname);
    const cleaned = normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "");
    return cleaned.startsWith("/") ? cleaned.slice(1) : cleaned;
  } catch {
    return "";
  }
}

function setHeaders(response, filePath) {
  const ext = extname(filePath).toLowerCase();
  response.setHeader("Content-Type", mimeTypes[ext] ?? "application/octet-stream");
  if (assetExtensions.has(ext)) {
    response.setHeader("Cache-Control", "public, max-age=2592000, immutable");
  } else {
    response.setHeader("Cache-Control", "no-cache");
  }
}

async function sendFile(response, filePath, statusCode = 200) {
  const fileStat = await stat(filePath);
  setHeaders(response, filePath);
  response.setHeader("Content-Length", fileStat.size);
  response.writeHead(statusCode);
  createReadStream(filePath).pipe(response);
}

const server = createServer(async (request, response) => {
  const requestPath = safePathname(new URL(request.url ?? "/", "http://localhost").pathname);
  const targetPath = resolve(rootDir, requestPath);

  if (!targetPath.startsWith(rootDir)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    if (requestPath && existsSync(targetPath)) {
      const targetStat = await stat(targetPath);
      if (targetStat.isFile()) {
        await sendFile(response, targetPath);
        return;
      }
    }

    if (assetExtensions.has(extname(targetPath).toLowerCase())) {
      response.writeHead(404).end("Not found");
      return;
    }

    await sendFile(response, indexPath);
  } catch {
    response.writeHead(500).end("Internal server error");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Frontend server listening on ${port}`);
});
