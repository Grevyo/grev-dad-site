function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}

function redirect(request, location) {
  return Response.redirect(new URL(location, request.url), 302);
}

function getCookieValue(cookieHeader, name) {
  const cookies = String(cookieHeader || "").split(";");
  for (const part of cookies) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

function buildSessionCookie(token) {
  const maxAge = 60 * 60 * 24 * 7;
  return `session_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}; Domain=.grev.dad`;
}

function clearSessionCookie() {
  return "session_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Domain=.grev.dad";
}

function toBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(str) {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

async function hashPassword(password, saltBase64, iterations = 100000) {
  const enc = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: fromBase64(saltBase64),
      iterations
    },
    key,
    256
  );

  return toBase64(new Uint8Array(bits));
}

function parseStoredHash(stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 4) return null;

  return {
    algorithm: parts[0],
    iterations: Number(parts[1]),
    saltBase64: parts[2],
    hashBase64: parts[3]
  };
}

async function touchUser(env, userId) {
  await env.DB.prepare(`
    UPDATE users
    SET last_seen_at = ?
    WHERE id = ?
  `)
    .bind(new Date().toISOString(), userId)
    .run();
}

async function getCurrentUser(request, env) {
  const token = getCookieValue(request.headers.get("Cookie"), "session_token");
  if (!token) return null;

  const user = await env.DB.prepare(`
    SELECT users.id, users.username, users.approved, users.is_admin, users.created_at, users.last_seen_at
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.session_token = ?
      AND sessions.expires_at > ?
    LIMIT 1
  `)
    .bind(token, new Date().toISOString())
    .first();

  return user || null;
}

function getStatus(lastSeenAt) {
  if (!lastSeenAt) return "offline";

  const now = Date.now();
  const seen = new Date(lastSeenAt).getTime();
  const diffMinutes = (now - seen) / 60000;

  if (diffMinutes <= 5) return "online";
  if (diffMinutes <= 30) return "away";
  return "offline";
}

async function requireApprovedUser(request, env) {
  const user = await getCurrentUser(request, env);
  if (!user || !user.approved) return null;
  await touchUser(env, user.id);
  return user;
}

async function requireAdminUser(request, env) {
  const user = await requireApprovedUser(request, env);
  if (!user || !user.is_admin) return null;
  return user;
}

async function serveAssetOr404(env, request) {
  if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") {
    return new Response("ASSETS binding is missing.", { status: 500 });
  }
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (path === "/api/ping") {
        return json({ ok: true });
      }

      // Register
      if (path === "/api/register" && request.method === "POST") {
        const form = await request.formData();
        const username = String(form.get("username") || "").trim();
        const password = String(form.get("password") || "");
        const password2 = String(form.get("password2") || "");

        if (!username || !password || !password2) {
          return redirect(request, "/register.html?msg=Please%20fill%20in%20all%20fields.");
        }

        if (!/^[A-Za-z0-9_-]{3,24}$/.test(username)) {
          return redirect(request, "/register.html?msg=Username%20must%20be%203-24%20characters.");
        }

        if (password !== password2) {
          return redirect(request, "/register.html?msg=Passwords%20do%20not%20match.");
        }

        if (password.length < 8) {
          return redirect(request, "/register.html?msg=Password%20must%20be%20at%20least%208%20characters.");
        }

        const existing = await env.DB.prepare(
          "SELECT id FROM users WHERE username = ? LIMIT 1"
        )
          .bind(username)
          .first();

        if (existing) {
          return redirect(request, "/register.html?msg=That%20username%20is%20already%20taken.");
        }

        const salt = crypto.getRandomValues(new Uint8Array(16));
        const saltBase64 = toBase64(salt);
        const hashBase64 = await hashPassword(password, saltBase64, 100000);
        const passwordHash = `pbkdf2_sha256$100000$${saltBase64}$${hashBase64}`;

        await env.DB.prepare(`
          INSERT INTO users (username, password_hash, approved, is_admin, created_at, last_seen_at)
          VALUES (?, ?, 0, 0, ?, ?)
        `)
          .bind(username, passwordHash, new Date().toISOString(), null)
          .run();

        return redirect(request, "/login.html?msg=Account%20created.%20Waiting%20for%20approval.");
      }

      // Login
      if (path === "/api/login" && request.method === "POST") {
        const form = await request.formData();
        const username = String(form.get("username") || "").trim();
        const password = String(form.get("password") || "");

        if (!username || !password) {
          return redirect(request, "/login.html?msg=Please%20enter%20username%20and%20password.");
        }

        const user = await env.DB.prepare(`
          SELECT id, username, password_hash, approved, is_admin, created_at, last_seen_at
          FROM users
          WHERE username = ?
          LIMIT 1
        `)
          .bind(username)
          .first();

        if (!user) {
          return redirect(request, "/login.html?msg=Invalid%20username%20or%20password.");
        }

        const parsed = parseStoredHash(user.password_hash);
        if (!parsed || parsed.algorithm !== "pbkdf2_sha256") {
          return redirect(request, "/login.html?msg=Account%20password%20format%20is%20invalid.");
        }

        const calc = await hashPassword(password, parsed.saltBase64, parsed.iterations);

        if (calc !== parsed.hashBase64) {
          return redirect(request, "/login.html?msg=Invalid%20username%20or%20password.");
        }

        if (!user.approved) {
          return redirect(request, "/login.html?msg=Your%20account%20has%20not%20been%20approved%20yet.");
        }

        const sessionToken = crypto.randomUUID();
        const now = new Date();
        const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        await env.DB.prepare(`
          INSERT INTO sessions (session_token, user_id, created_at, expires_at)
          VALUES (?, ?, ?, ?)
        `)
          .bind(sessionToken, user.id, now.toISOString(), expires.toISOString())
          .run();

        await touchUser(env, user.id);

        return new Response(null, {
          status: 302,
          headers: {
            "Location": new URL("/members.html", request.url).toString(),
            "Set-Cookie": buildSessionCookie(sessionToken)
          }
        });
      }

      // Logout
      if (path === "/api/logout") {
        const token = getCookieValue(request.headers.get("Cookie"), "session_token");

        if (token) {
          await env.DB.prepare(
            "DELETE FROM sessions WHERE session_token = ?"
          )
            .bind(token)
            .run();
        }

        return new Response(null, {
          status: 302,
          headers: {
            "Location": new URL("/login.html?msg=Logged%20out.", request.url).toString(),
            "Set-Cookie": clearSessionCookie()
          }
        });
      }

      // Me
      if (path === "/api/me") {
        const user = await getCurrentUser(request, env);

        if (!user || !user.approved) {
          return json({ loggedIn: false }, 401);
        }

        await touchUser(env, user.id);

        return json({
          loggedIn: true,
          user: {
            id: user.id,
            username: user.username,
            is_admin: user.is_admin,
            created_at: user.created_at
          }
        });
      }

      // Members
      if (path === "/api/members") {
        const currentUser = await requireApprovedUser(request, env);
        if (!currentUser) {
          return json({ error: "Not logged in" }, 401);
        }

        const members = await env.DB.prepare(`
          SELECT id, username, is_admin, created_at, last_seen_at
          FROM users
          WHERE approved = 1
          ORDER BY username ASC
        `).all();

        const mapped = (members.results || []).map(member => ({
          id: member.id,
          username: member.username,
          is_admin: member.is_admin,
          created_at: member.created_at,
          status: getStatus(member.last_seenAt || member.last_seen_at)
        }));

        return json({ members: mapped });
      }

      // Global chat - get messages
      if (path === "/api/chat/global/messages") {
        const user = await requireApprovedUser(request, env);
        if (!user) {
          return json({ error: "Not logged in" }, 401);
        }

        const messages = await env.DB.prepare(`
          SELECT id, author_username, message, created_at
          FROM global_chat_messages
          ORDER BY id DESC
          LIMIT 50
        `).all();

        const results = (messages.results || []).reverse();
        return json({ messages: results });
      }

      // Global chat - send message
      if (path === "/api/chat/global/send" && request.method === "POST") {
        const user = await requireApprovedUser(request, env);
        if (!user) {
          return json({ error: "Not logged in" }, 401);
        }

        const body = await request.json();
        const message = String(body.message || "").trim();

        if (!message) {
          return json({ error: "Message is empty" }, 400);
        }

        if (message.length > 500) {
          return json({ error: "Message too long" }, 400);
        }

        await env.DB.prepare(`
          INSERT INTO global_chat_messages (author_user_id, author_username, message, created_at)
          VALUES (?, ?, ?, ?)
        `)
          .bind(user.id, user.username, message, new Date().toISOString())
          .run();

        return json({ ok: true });
      }

      // Admin - pending users
      if (path === "/api/admin/pending-users") {
        const admin = await requireAdminUser(request, env);
        if (!admin) {
          return json({ error: "Forbidden" }, 403);
        }

        const users = await env.DB.prepare(`
          SELECT username, created_at
          FROM users
          WHERE approved = 0
          ORDER BY created_at ASC
        `).all();

        return json({ users: users.results || [] });
      }

      // Admin - approve user
      if (path === "/api/admin/approve-user" && request.method === "POST") {
        const admin = await requireAdminUser(request, env);
        if (!admin) {
          return json({ error: "Forbidden" }, 403);
        }

        const body = await request.json();
        const username = String(body.username || "").trim();

        if (!username) {
          return json({ error: "Missing username" }, 400);
        }

        await env.DB.prepare(`
          UPDATE users
          SET approved = 1
          WHERE username = ?
        `)
          .bind(username)
          .run();

        return json({ ok: true });
      }

      // Admin - reject user
      if (path === "/api/admin/reject-user" && request.method === "POST") {
        const admin = await requireAdminUser(request, env);
        if (!admin) {
          return json({ error: "Forbidden" }, 403);
        }

        const body = await request.json();
        const username = String(body.username || "").trim();

        if (!username) {
          return json({ error: "Missing username" }, 400);
        }

        await env.DB.prepare(`
          DELETE FROM users
          WHERE username = ?
            AND approved = 0
        `)
          .bind(username)
          .run();

        return json({ ok: true });
      }

      // Admin - forum posts list
      if (path === "/api/admin/forum-posts") {
        const admin = await requireAdminUser(request, env);
        if (!admin) {
          return json({ error: "Forbidden" }, 403);
        }

        const posts = await env.DB.prepare(`
          SELECT id, subject, author_username, created_at
          FROM forum_posts
          ORDER BY id DESC
        `).all();

        return json({ posts: posts.results || [] });
      }

      // Admin - remove forum post
      if (path === "/api/admin/remove-post" && request.method === "POST") {
        const admin = await requireAdminUser(request, env);
        if (!admin) {
          return json({ error: "Forbidden" }, 403);
        }

        const body = await request.json();
        const postId = body.post_id;

        if (!postId) {
          return json({ error: "Missing post_id" }, 400);
        }

        await env.DB.prepare(`DELETE FROM forum_comments WHERE post_id = ?`)
          .bind(postId)
          .run();

        await env.DB.prepare(`DELETE FROM forum_posts WHERE id = ?`)
          .bind(postId)
          .run();

        return json({ ok: true });
      }

      // Forum - list posts
      if (path === "/api/forum/posts") {
        const posts = await env.DB.prepare(`
          SELECT id, subject, author_username, created_at
          FROM forum_posts
          ORDER BY id DESC
        `).all();

        return json({ posts: posts.results || [] });
      }

      // Forum - create post
      if (path === "/api/forum/create-post" && request.method === "POST") {
        const user = await requireApprovedUser(request, env);
        if (!user) {
          return json({ error: "Not logged in" }, 401);
        }

        const body = await request.json();
        const subject = String(body.subject || "").trim();
        const description = String(body.description || "").trim();
        const imageUrl = String(body.image_url || "").trim();

        if (!subject || !description) {
          return json({ error: "Missing subject or description" }, 400);
        }

        await env.DB.prepare(`
          INSERT INTO forum_posts (subject, description, image_url, author_user_id, author_username, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
          .bind(
            subject,
            description,
            imageUrl || null,
            user.id,
            user.username,
            new Date().toISOString()
          )
          .run();

        return json({ ok: true });
      }

      // Forum - single post
      if (path === "/api/forum/post") {
        const postId = url.searchParams.get("id");

        if (!postId) {
          return json({ post: null }, 400);
        }

        const post = await env.DB.prepare(`
          SELECT id, subject, description, image_url, author_username, created_at
          FROM forum_posts
          WHERE id = ?
          LIMIT 1
        `)
          .bind(postId)
          .first();

        return json({ post: post || null });
      }

      // Forum - comments
      if (path === "/api/forum/comments") {
        const postId = url.searchParams.get("post_id");

        if (!postId) {
          return json({ comments: [] }, 400);
        }

        const comments = await env.DB.prepare(`
          SELECT id, author_username, comment, created_at
          FROM forum_comments
          WHERE post_id = ?
          ORDER BY id ASC
        `)
          .bind(postId)
          .all();

        return json({ comments: comments.results || [] });
      }

      // Forum - create comment
      if (path === "/api/forum/create-comment" && request.method === "POST") {
        const user = await requireApprovedUser(request, env);
        if (!user) {
          return json({ error: "Not logged in" }, 401);
        }

        const body = await request.json();
        const postId = body.post_id;
        const comment = String(body.comment || "").trim();

        if (!postId || !comment) {
          return json({ error: "Missing post_id or comment" }, 400);
        }

        await env.DB.prepare(`
          INSERT INTO forum_comments (post_id, author_user_id, author_username, comment, created_at)
          VALUES (?, ?, ?, ?, ?)
        `)
          .bind(
            postId,
            user.id,
            user.username,
            comment,
            new Date().toISOString()
          )
          .run();

        return json({ ok: true });
      }

      // Protected pages
      if (
        path === "/members.html" ||
        path === "/profile.html" ||
        path === "/admin.html" ||
        path === "/new-post.html"
      ) {
        const user = await requireApprovedUser(request, env);
        if (!user) {
          return redirect(request, "/login.html?msg=Please%20log%20in.");
        }

        if (path === "/admin.html" && !user.is_admin) {
          return redirect(request, "/members.html?msg=Admin%20access%20only.");
        }
      }

      return serveAssetOr404(env, request);
    } catch (err) {
      return new Response(
        "Worker crash:\n\n" + (err && err.stack ? err.stack : String(err)),
        {
          status: 500,
          headers: {
            "content-type": "text/plain; charset=utf-8"
          }
        }
      );
    }
  }
};