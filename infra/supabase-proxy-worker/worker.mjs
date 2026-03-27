/**
 * Supabase proxy Worker with Realtime WebSocket support.
 *
 * Routes:
 * - HTTPS REST/Auth/Storage/Functions -> forwarded to Supabase host
 * - WSS /realtime/v1/websocket -> upgraded and tunneled via WebSocketPair
 *
 * Deploy with wrangler, then set EXPO_PUBLIC_SUPABASE_URL to the workers.dev/custom-domain URL.
 */

export default {
  async fetch(request, env) {
    const targetBase = (env.SUPABASE_TARGET_URL || "").replace(/\/$/, "");
    if (!targetBase) {
      return new Response("Missing SUPABASE_TARGET_URL", { status: 500 });
    }

    const targetOrigin = new URL(targetBase).origin;
    const reqUrl = new URL(request.url);

    // Build target URL preserving path/query.
    const targetUrl = new URL(reqUrl.pathname + reqUrl.search, targetOrigin);

    // Handle Realtime websocket upgrade.
    const upgrade = request.headers.get("Upgrade");
    if (upgrade && upgrade.toLowerCase() === "websocket") {
      const pair = new WebSocketPair();
      const client = pair[0];
      const workerSocket = pair[1];
      workerSocket.accept();

      // Connect upstream websocket to Supabase realtime endpoint.
      const upstreamResp = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });

      const upstreamSocket = upstreamResp.webSocket;
      if (!upstreamSocket) {
        workerSocket.close(1011, "Upstream websocket unavailable");
        return new Response("Upstream websocket unavailable", { status: 502 });
      }
      upstreamSocket.accept();

      // Pipe messages both ways.
      workerSocket.addEventListener("message", (evt) => {
        try {
          upstreamSocket.send(evt.data);
        } catch (_) {}
      });
      upstreamSocket.addEventListener("message", (evt) => {
        try {
          workerSocket.send(evt.data);
        } catch (_) {}
      });

      const closeBoth = (code, reason) => {
        try {
          workerSocket.close(code, reason);
        } catch (_) {}
        try {
          upstreamSocket.close(code, reason);
        } catch (_) {}
      };

      workerSocket.addEventListener("close", (evt) => closeBoth(evt.code || 1000, evt.reason || "client closed"));
      workerSocket.addEventListener("error", () => closeBoth(1011, "worker socket error"));
      upstreamSocket.addEventListener("close", (evt) => closeBoth(evt.code || 1000, evt.reason || "upstream closed"));
      upstreamSocket.addEventListener("error", () => closeBoth(1011, "upstream socket error"));

      return new Response(null, { status: 101, webSocket: client });
    }

    // Normal HTTP pass-through.
    const headers = new Headers(request.headers);
    headers.set("Host", new URL(targetOrigin).host);
    headers.set("Origin", targetOrigin);

    const resp = await fetch(targetUrl.toString(), {
      method: request.method,
      headers,
      body: request.body,
      redirect: "follow",
    });

    // CORS passthrough for web app calls.
    const outHeaders = new Headers(resp.headers);
    outHeaders.set("Access-Control-Allow-Origin", request.headers.get("Origin") || "*");
    outHeaders.set("Access-Control-Allow-Credentials", "true");
    outHeaders.set("Access-Control-Allow-Headers", "authorization, apikey, content-type, x-client-info");
    outHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: outHeaders });
    }

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: outHeaders,
    });
  },
};

