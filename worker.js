/**
 * H.I — Henderson Innovations edge server.
 * Protects client previews with server-side credentials and signed sessions.
 * Credentials live in KV; nothing sensitive is shipped to the browser.
 */

const COOKIE = "hi_preview";
const SESSION_TTL = 60 * 60 * 24 * 7;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });
}

function parseCookies(request) {
  const raw = request.headers.get("cookie") || "";
  const out = {};
  raw.split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function bytesToHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function derive(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(saltHex), iterations },
    key, 256
  );
  return bytesToHex(bits);
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function users(env) {
  return (await env.HI_KV.get("preview_users", "json")) || {};
}

async function sessionFor(request, env) {
  const token = parseCookies(request)[COOKIE];
  if (!token) return null;
  return await env.HI_KV.get(`session:${token}`, "json");
}

function cookieHeader(token) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL}`;
}

function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ---- auth API ------------------------------------------------------
    if (path === "/api/preview/login" && request.method === "POST") {
      let body;
      try { body = await request.json(); } catch { return json({ detail: "bad request" }, 400); }
      const username = String(body.u || "").trim().toLowerCase();
      const password = String(body.p || "");
      if (!username || !password) return json({ detail: "missing credentials" }, 400);

      const ip = request.headers.get("cf-connecting-ip") || "local";
      const failKey = `fail:${ip}`;
      const fails = parseInt((await env.HI_KV.get(failKey)) || "0", 10);
      if (fails >= 8) return json({ detail: "too many attempts" }, 429);

      const all = await users(env);
      const entry = all[username];
      let ok = false;
      if (entry) {
        const digest = await derive(password, entry.salt, entry.iter || 200000);
        ok = safeEqual(digest, entry.hash);
      }
      if (!ok) {
        await env.HI_KV.put(failKey, String(fails + 1), { expirationTtl: 300 });
        return json({ detail: "invalid credentials" }, 401);
      }

      await env.HI_KV.delete(failKey);
      const token = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
      const session = { u: username, slug: entry.slug, name: entry.name };
      await env.HI_KV.put(`session:${token}`, JSON.stringify(session), { expirationTtl: SESSION_TTL });
      return json({ ok: true, slug: entry.slug, name: entry.name }, 200, { "set-cookie": cookieHeader(token) });
    }

    if (path === "/api/preview/logout" && request.method === "POST") {
      const token = parseCookies(request)[COOKIE];
      if (token) await env.HI_KV.delete(`session:${token}`);
      return json({ ok: true }, 200, { "set-cookie": clearCookie() });
    }

    if (path === "/api/preview/session") {
      const session = await sessionFor(request, env);
      if (!session) return json({ detail: "authentication required" }, 401);
      return json({ ok: true, user: session.u, slug: session.slug, name: session.name });
    }

    // ---- gate client previews -----------------------------------------
    if (path === "/client-preview/viewer.html") {
      const session = await sessionFor(request, env);
      if (!session) return Response.redirect(new URL("/client-preview/", url).toString(), 302);
      return env.ASSETS.fetch(request);
    }

    if (path.startsWith("/client-preview/sites/")) {
      const session = await sessionFor(request, env);
      if (!session) return new Response("Authentication required", { status: 401 });
      const slug = path.split("/")[3] || "";
      if (slug !== session.slug) return new Response("Forbidden", { status: 403 });
      const asset = await env.ASSETS.fetch(request);
      const headers = new Headers(asset.headers);
      headers.set("cache-control", "private, no-store");
      headers.set("x-robots-tag", "noindex, nofollow");
      headers.set("x-frame-options", "SAMEORIGIN");
      return new Response(asset.body, { status: asset.status, headers });
    }

    if (path.startsWith("/client-preview/")) {
      const asset = await env.ASSETS.fetch(request);
      const headers = new Headers(asset.headers);
      headers.set("x-robots-tag", "noindex, nofollow");
      return new Response(asset.body, { status: asset.status, headers });
    }

    // marketing site is public (serve index.html for the root)
    if (path === "/" || path === "") {
      const root = new URL("/index.html", url);
      return env.ASSETS.fetch(new Request(root.toString(), request));
    }
    return env.ASSETS.fetch(request);
  }
};
