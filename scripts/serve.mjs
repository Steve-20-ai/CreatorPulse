import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = normalize(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function handleRequest(request, response) {
  const requestPath = decodeURIComponent((request.url || "/").split("?")[0]);
  const relativePath = requestPath === "/" ? "web/index.html" : requestPath.endsWith("/") ? requestPath.replace(/^\/+/, "") + "index.html" : requestPath.replace(/^\/+/, "");
  const resolved = normalize(join(root, relativePath));

  if (!resolved.startsWith(root) || !existsSync(resolved) || statSync(resolved).isDirectory()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes[extname(resolved).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(resolved).pipe(response);
}

const listenerOptions = process.env.HOST
  ? [{ host: process.env.HOST }]
  : [
      { host: "127.0.0.1" },
      { host: "::1", ipv6Only: true },
    ];

let announced = false;
for (const options of listenerOptions) {
  const server = createServer(handleRequest);
  server.on("error", (error) => {
    if (options.host === "::1" && ["EAFNOSUPPORT", "EADDRNOTAVAIL"].includes(error.code)) {
      console.warn("IPv6 localhost is unavailable; continuing with IPv4 localhost.");
      return;
    }
    throw error;
  });
  server.listen({ port, ...options }, () => {
    if (!announced) {
      announced = true;
      console.log(`CreatorPulse is running at http://localhost:${port}/web/`);
    }
  });
}



