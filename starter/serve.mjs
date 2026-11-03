#!/usr/bin/env node
// Serves dist/ on http://127.0.0.1:4173 (or PORT). No dependencies.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "dist");
const argPort = process.argv.indexOf("--port");
const port = Number(argPort > 0 ? process.argv[argPort + 1] : process.env.PORT ?? 4173);
const types = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".css": "text/css", ".js": "text/javascript" };

if (!existsSync(join(root, "index.html"))) {
  console.error("dist/index.html not found. Run `node build.mjs` first.");
  process.exit(1);
}

createServer((req, res) => {
  let rel;
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
  } catch {
    res.writeHead(400).end("Bad request");
    return;
  }
  const file = join(root, rel || "index.html");
  if (!file.startsWith(root + sep) && file !== root) { res.writeHead(403).end(); return; }
  const target = existsSync(file) && statSync(file).isDirectory() ? join(file, "index.html") : file;
  if (!existsSync(target)) { res.writeHead(404).end("Not found"); return; }
  res.writeHead(200, { "content-type": types[extname(target)] ?? "application/octet-stream" });
  createReadStream(target).pipe(res);
})
  .on("error", (e) => {
    if (e.code === "EADDRINUSE") console.error(`Port ${port} is already in use. Try: node serve.mjs --port ${port + 1}`);
    else console.error(e.message);
    process.exit(1);
  })
  .listen(port, "127.0.0.1", () => console.log(`Your Tube: http://127.0.0.1:${port}/`));
