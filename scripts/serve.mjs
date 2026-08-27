import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (match) => match.slice(1)));
const requestedPort = Number(process.env.PORT ?? 4174);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8"
};

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const candidate = normalize(join(root, relativePath));
  if (!candidate.startsWith(root)) return respond(response, 403, "Forbidden");

  let path = candidate;
  try {
    if (statSync(path).isDirectory()) path = join(path, "index.html");
    const stream = createReadStream(path);
    response.writeHead(200, { "Content-Type": mimeTypes[extname(path)] || "application/octet-stream", "Cache-Control": "no-store" });
    stream.on("error", () => respond(response, 404, "Not found"));
    stream.pipe(response);
  } catch {
    respond(response, 404, "Not found");
  }
});

server.listen(requestedPort, "127.0.0.1", () => {
  const { port } = server.address();
  console.log(`Academy Operations Hub: http://127.0.0.1:${port}`);
});

function respond(response, status, body) {
  if (response.headersSent) return response.end();
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(body);
}
