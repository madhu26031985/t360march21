import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "local-web-test");
const PORT = Number(process.env.PORT) || 8765;

/** Merge root `.env` into `process.env` (same keys as Expo: EXPO_PUBLIC_*). */
function loadRootEnv() {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    let val = match[2].trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = val;
  }
}

loadRootEnv();

function supabasePublicConfig() {
  const web = process.env.EXPO_PUBLIC_SUPABASE_WEB_URL?.replace(/\/$/, "").trim();
  const main = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "").trim();
  const supabaseUrl = (web || main || "").trim();
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !anonKey) {
    return {
      ok: false,
      error:
        "Missing EXPO_PUBLIC_SUPABASE_ANON_KEY and a URL (EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_WEB_URL). See .env.example.",
    };
  }
  return { ok: true, supabaseUrl, anonKey };
}

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

function handleApi(req, res) {
  if (req.method !== "GET") return false;
  let url;
  try {
    url = new URL(req.url || "/", "http://127.0.0.1");
  } catch {
    return false;
  }
  const { pathname, searchParams } = url;

  if (pathname === "/api/ping") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ ok: true, t: Date.now() }));
    return true;
  }

  if (pathname === "/api/delay") {
    const ms = Math.min(30_000, Math.max(0, Number(searchParams.get("ms")) || 0));
    setTimeout(() => {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify({ ok: true, delayedMs: ms, t: Date.now() }));
    }, ms);
    return true;
  }

  if (pathname === "/api/blob") {
    const kb = Math.min(512, Math.max(1, Number(searchParams.get("kb")) || 50));
    const chunk = "x".repeat(1024);
    const body = chunk.repeat(kb);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(body);
    return true;
  }

  if (pathname === "/api/auth-env") {
    const cfg = supabasePublicConfig();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(cfg));
    return true;
  }

  return false;
}

const server = http.createServer((req, res) => {
  try {
    if (handleApi(req, res)) return;

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
  const base = `http://127.0.0.1:${PORT}`;
  console.log(`Local test web: ${base}`);
  console.log(`Google OAuth test page: ${base}/google-auth.html`);
  const cfg = supabasePublicConfig();
  if (!cfg.ok) console.log(`(Supabase env: ${cfg.error})`);
});
