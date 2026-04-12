import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "local-web-test");
const PORT = Number(process.env.PORT) || 8765;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};

function filePathFromUrl(urlPath) {
  const pathname = decodeURIComponent(new URL(urlPath || "/", "http://localhost").pathname);
  const segments = pathname.split("/").filter((s) => s && s !== "." && s !== "..");
  if (segments.length === 0) return path.join(ROOT, "index.html");
  return path.join(ROOT, ...segments);
}

const server = http.createServer((req, res) => {
  try {
    const filePath = filePathFromUrl(req.url);
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      const fallback = path.join(ROOT, "index.html");
      if (fs.existsSync(fallback)) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        fs.createReadStream(fallback).pipe(res);
        return;
      }
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    res.setHeader("Content-Type", mime[ext] || "application/octet-stream");
    fs.createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(400);
    res.end("Bad request");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Local test web: http://127.0.0.1:${PORT}`);
});
