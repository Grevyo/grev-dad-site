// src/index.js

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env, ctx);
    } catch (error) {
      console.error("Unhandled worker error:", error);
      return json(
        {
          success: false,
          error: "Internal server error"
        },
        500
      );
    }
  }
};

const SESSION_COOKIE_NAME = "grevdad_session";
const SESSION_DAYS = 30;
const DEFAULT_USER_GROUP = "standard";
const GLOBAL_CHAT_MESSAGE_LIMIT = 100;
const FORUM_POST_LIMIT = 100;
const ALLOWED_GROUPS = ["admin", "dev", "staff", "mod", "higher", "member", "standard"];
const MODERATION_GROUPS = new Set(["admin", "dev", "staff"]);

async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const { pathname } = url;

  if (request.method === "OPTIONS") {
    return handleOptions();
  }

  if (pathname === "/api/health" && request.method === "GET") {
    return json({
      success: true,
      message: "grev.dad worker is running"
    });
  }

  if (pathname === "/api/setup" && request.method === "POST") {
    return await handleSetup(env);
  }

  // Auth
  if (pathname === "/api/auth/register" && request.method === "POST") {
    return await handleRegister(request, env);
  }

  if (pathname === "/api/auth/login" && request.method === "POST") {
    return await handleLogin(request, env);
  }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    return await handleLogout(request, env);
  }

  if (pathname === "/api/auth/me" && request.method === "GET") {
    return await handleMe(request, env);
  }

  // Users
  if (pathname === "/api/users/members" && request.method === "GET") {
    return await handleMembers(request, env);
  }

  // Global chat
  if (pathname === "/api/chat/global" && request.method === "GET") {
    return await handleGetGlobalChat(env);
  }

  if (pathname === "/api/chat/global" && request.method === "POST") {
    return await handlePostGlobalChat(request, env);
  }

  // Forum
  if (pathname === "/api/forum/posts" && request.method === "GET") {
    return await handleForumPosts(request, env);
  }

  if (pathname === "/api/forum/post" && request.method === "GET") {
    return await handleForumPost(request, env);
  }

  if (pathname === "/api/forum/comments" && request.method === "GET") {
    return await handleForumComments(request, env);
  }

  if (pathname === "/api/forum/create-post" && request.method === "POST") {
    return await handleForumCreatePost(request, env);
  }

  if (pathname === "/api/forum/create-comment" && request.method === "POST") {
    return await handleForumCreateComment(request, env);
  }

  if (pathname === "/api/forum/react" && request.method === "POST") {
    return await handleForumReact(request, env);
  }

  if (pathname === "/api/forum/remove-post" && request.method === "POST") {
    return await handleForumRemovePost(request, env);
  }

  // Admin
  if (pathname === "/api/admin/users" && request.method === "GET") {
    return await handleAdminUsers(request, env);
  }

  if (pathname === "/api/admin/user" && request.method === "GET") {
    return await handleAdminUser(request, env);
  }

  if (pathname === "/api/admin/user/update" && request.method === "POST") {
    return await handleAdminUpdateUser(request, env);
  }

  if (pathname === "/api/admin/pending-users" && request.method === "GET") {
    return await handleAdminPendingUsers(env, request);
  }

  // Future routes
  if (pathname === "/api/chat/private" && request.method === "GET") {
    return json({
      success: true,
      messages: [],
      note: "Private chat route is ready for a later phase"
    });
  }

  if (pathname === "/api/chat/private" && request.method === "POST") {
    return json(
      {
        success: false,
        error: "Private chat sending will be added in a later phase"
      },
      501
    );
  }

  if (pathname.startsWith("/api/cases")) {
    return json(
      {
        success: false,
        error: "Cases routes will be added in a later phase"
      },
      501
    );
  }

  if (env.ASSETS) {
    return env.ASSETS.fetch(request);
  }

  return json(
    {
      success: false,
      error: "Not found"
    },
    404
  );
}

/* -------------------------------------------------------------------------- */
/*                               SETUP / SCHEMA                               */
/* -------------------------------------------------------------------------- */

async function handleSetup(env) {
  await ensureCoreTables(env);

  return json({
    success: true,
    message: "Core database tables created or already exist"
  });
}

async function ensureCoreTables(env) {
  if (!env.DB) {
    throw new Error("Missing DB binding");
  }

  const statements = [
    `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      approved INTEGER NOT NULL DEFAULT 0,
      is_admin INTEGER NOT NULL DEFAULT 0,
      group_name TEXT NOT NULL DEFAULT 'standard',
      created_at TEXT NOT NULL,
      last_seen_at TEXT
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_token TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id INTEGER PRIMARY KEY,
      bio TEXT,
      avatar_url TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS global_chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_user_id INTEGER NOT NULL,
      author_username TEXT NOT NULL,
      author_group TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS forum_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_user_id INTEGER NOT NULL,
      author_username TEXT NOT NULL,
      author_group TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS forum_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      author_user_id INTEGER NOT NULL,
      author_username TEXT NOT NULL,
      author_group TEXT NOT NULL,
      comment TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS forum_reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      reaction_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(post_id, user_id),
      FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_users_username
    ON users (username)
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_users_group_name
    ON users (group_name)
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_users_approved
    ON users (approved)
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_sessions_token
    ON sessions (session_token)
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_global_chat_created_at
    ON global_chat_messages (created_at)
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_forum_posts_created_at
    ON forum_posts (created_at)
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_forum_comments_post_id
    ON forum_comments (post_id)
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_forum_reactions_post_id
    ON forum_reactions (post_id)
    `
  ];

  for (const sqlText of statements) {
    await env.DB.prepare(sqlText).run();
  }
}

/* -------------------------------------------------------------------------- */
/*                                   AUTH                                     */
/* -------------------------------------------------------------------------- */

async function handleRegister(request, env) {
  await ensureCoreTables(env);

  const body = await safeJson(request);
  const username = cleanUsername(body?.username);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || username.length < 3) {
    return json({ success: false, error: "Username must be at least 3 characters" }, 400);
  }

  if (password.length < 6) {
    return json({ success: false, error: "Password must be at least 6 characters" }, 400);
  }

  const existingUser = await env.DB.prepare(
    `SELECT id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1`
  ).bind(username).first();

  if (existingUser) {
    return json({ success: false, error: "Username already exists" }, 409);
  }

  const passwordHash = await hashPassword(password);
  const now = isoNow();

  const result = await env.DB.prepare(
    `
    INSERT INTO users (
      username,
      password_hash,
      approved,
      is_admin,
      group_name,
      created_at,
      last_seen_at
    )
    VALUES (?, ?, 0, 0, ?, ?, ?)
    `
  ).bind(username, passwordHash, DEFAULT_USER_GROUP, now, now).run();

  const userId = result.meta?.last_row_id ?? null;

  if (userId) {
    await env.DB.prepare(
      `
      INSERT OR IGNORE INTO user_profiles (user_id, bio, avatar_url)
      VALUES (?, '', '')
      `
    ).bind(userId).run();
  }

  return json({
    success: true,
    message: "Registration submitted. Your account is awaiting approval."
  });
}

async function handleLogin(request, env) {
  await ensureCoreTables(env);

  const body = await safeJson(request);
  const username = cleanUsername(body?.username);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || !password) {
    return json({ success: false, error: "Username and password are required" }, 400);
  }

  const user = await env.DB.prepare(
    `
    SELECT id, username, password_hash, approved, is_admin, group_name
    FROM users
    WHERE LOWER(username) = LOWER(?)
    LIMIT 1
    `
  ).bind(username).first();

  if (!user) {
    return json({ success: false, error: "Invalid username or password" }, 401);
  }

  const passwordOk = await verifyPassword(password, user.password_hash);
  if (!passwordOk) {
    return json({ success: false, error: "Invalid username or password" }, 401);
  }

  if (!Number(user.approved)) {
    return json({ success: false, error: "Your account is still awaiting approval" }, 403);
  }

  const sessionToken = crypto.randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await env.DB.prepare(
    `
    INSERT INTO sessions (session_token, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
    `
  ).bind(sessionToken, user.id, now.toISOString(), expires.toISOString()).run();

  await env.DB.prepare(
    `
    UPDATE users
    SET last_seen_at = ?
    WHERE id = ?
    `
  ).bind(now.toISOString(), user.id).run();

  const group = normaliseGroupName(user.group_name, Boolean(user.is_admin));

  const response = json({
    success: true,
    message: "Login successful",
    user: {
      id: user.id,
      username: user.username,
      approved: Boolean(user.approved),
      is_admin: Boolean(user.is_admin),
      group,
      groups: buildUserGroups(group, Boolean(user.is_admin))
    }
  });

  response.headers.append("Set-Cookie", buildSessionCookie(sessionToken, expires));
  return response;
}

async function handleLogout(request, env) {
  await ensureCoreTables(env);

  const cookies = parseCookies(request.headers.get("Cookie") || "");
  const sessionToken = cookies[SESSION_COOKIE_NAME];

  if (sessionToken) {
    await env.DB.prepare(`DELETE FROM sessions WHERE session_token = ?`)
      .bind(sessionToken)
      .run();
  }

  const response = json({
    success: true,
    message: "Logged out"
  });

  response.headers.append("Set-Cookie", clearSessionCookie());
  return response;
}

async function handleMe(request, env) {
  await ensureCoreTables(env);

  const session = await getSessionUser(request, env);

  if (!session) {
    return json({ success: false, authenticated: false }, 401);
  }

  const group = normaliseGroupName(session.group_name, Boolean(session.is_admin));

  return json({
    success: true,
    authenticated: true,
    user: {
      id: session.id,
      username: session.username,
      approved: Boolean(session.approved),
      is_admin: Boolean(session.is_admin),
      group,
      groups: buildUserGroups(group, Boolean(session.is_admin)),
      can_moderate_forum: canModerateForum(group, Boolean(session.is_admin)),
      bio: session.bio || "",
      avatar_url: session.avatar_url || "",
      last_seen_at: session.last_seen_at || null
    }
  });
}

/* -------------------------------------------------------------------------- */
/*                                   USERS                                    */
/* -------------------------------------------------------------------------- */

async function handleMembers(request, env) {
  await ensureCoreTables(env);

  const session = await getSessionUser(request, env);
  if (!session) {
    return json({ success: false, error: "Not authenticated" }, 401);
  }

  const rows = await env.DB.prepare(
    `
    SELECT
      u.id,
      u.username,
      u.is_admin,
      u.group_name,
      u.last_seen_at,
      p.bio,
      p.avatar_url
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    WHERE u.approved = 1
    ORDER BY LOWER(u.username) ASC
    `
  ).all();

  const members = (rows.results || []).map((row) => {
    const group = normaliseGroupName(row.group_name, Boolean(row.is_admin));
    return {
      id: row.id,
      username: row.username,
      is_admin: Boolean(row.is_admin),
      group,
      groups: buildUserGroups(group, Boolean(row.is_admin)),
      last_seen_at: row.last_seen_at || null,
      bio: row.bio || "",
      avatar_url: row.avatar_url || ""
    };
  });

  return json({ success: true, members });
}

/* -------------------------------------------------------------------------- */
/*                                GLOBAL CHAT                                 */
/* -------------------------------------------------------------------------- */

async function handleGetGlobalChat(env) {
  await ensureCoreTables(env);

  const rows = await env.DB.prepare(
    `
    SELECT id, author_user_id, author_username, author_group, message, created_at
    FROM global_chat_messages
    ORDER BY id DESC
    LIMIT ?
    `
  ).bind(GLOBAL_CHAT_MESSAGE_LIMIT).all();

  return json({
    success: true,
    messages: (rows.results || []).reverse()
  });
}

async function handlePostGlobalChat(request, env) {
  await ensureCoreTables(env);

  const session = await getSessionUser(request, env);
  if (!session) {
    return json({ success: false, error: "You must be logged in to send messages" }, 401);
  }

  const body = await safeJson(request);
  const message = cleanMessage(body?.message);

  if (!message) {
    return json({ success: false, error: "Message cannot be empty" }, 400);
  }

  const authorGroup = displayGroupName(
    normaliseGroupName(session.group_name, Boolean(session.is_admin)),
    Boolean(session.is_admin)
  );

  const now = isoNow();

  const result = await env.DB.prepare(
    `
    INSERT INTO global_chat_messages (
      author_user_id,
      author_username,
      author_group,
      message,
      created_at
    )
    VALUES (?, ?, ?, ?, ?)
    `
  ).bind(session.id, session.username, authorGroup, message, now).run();

  await env.DB.prepare(
    `
    UPDATE users
    SET last_seen_at = ?
    WHERE id = ?
    `
  ).bind(now, session.id).run();

  return json({
    success: true,
    message: "Message sent",
    chat_message: {
      id: result.meta?.last_row_id ?? null,
      author_user_id: session.id,
      author_username: session.username,
      author_group: authorGroup,
      message,
      created_at: now
    }
  });
}

/* -------------------------------------------------------------------------- */
/*                                   FORUM                                    */
/* -------------------------------------------------------------------------- */

async function handleForumPosts(request, env) {
  await ensureCoreTables(env);

  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").trim().toLowerCase();
  const session = await getSessionUser(request, env);

  const rows = await env.DB.prepare(
    `
    SELECT
      p.id,
      p.author_user_id,
      p.author_username,
      p.author_group,
      p.title,
      p.body,
      p.created_at,
      p.updated_at,
      COALESCE(c.comment_count, 0) AS comment_count,
      COALESCE(r.like_count, 0) AS like_count,
      COALESCE(r.dislike_count, 0) AS dislike_count
    FROM forum_posts p
    LEFT JOIN (
      SELECT post_id, COUNT(*) AS comment_count
      FROM forum_comments
      GROUP BY post_id
    ) c ON c.post_id = p.id
    LEFT JOIN (
      SELECT
        post_id,
        SUM(CASE WHEN reaction_type = 'like' THEN 1 ELSE 0 END) AS like_count,
        SUM(CASE WHEN reaction_type = 'dislike' THEN 1 ELSE 0 END) AS dislike_count
      FROM forum_reactions
      GROUP BY post_id
    ) r ON r.post_id = p.id
    ORDER BY p.id DESC
    LIMIT ?
    `
  ).bind(FORUM_POST_LIMIT).all();

  let posts = rows.results || [];

  if (search) {
    posts = posts.filter((post) =>
      String(post.title || "").toLowerCase().includes(search) ||
      String(post.body || "").toLowerCase().includes(search) ||
      String(post.author_username || "").toLowerCase().includes(search)
    );
  }

  return json({
    success: true,
    posts: posts.map((post) => ({
      ...post,
      can_remove: session
        ? canModerateForum(
            normaliseGroupName(session.group_name, Boolean(session.is_admin)),
            Boolean(session.is_admin)
          )
        : false
    }))
  });
}

async function handleForumPost(request, env) {
  await ensureCoreTables(env);

  const url = new URL(request.url);
  const postId = Number(url.searchParams.get("id") || "");
  const session = await getSessionUser(request, env);

  if (!Number.isInteger(postId) || postId <= 0) {
    return json({ success: false, error: "A valid post id is required" }, 400);
  }

  const post = await env.DB.prepare(
    `
    SELECT
      p.id,
      p.author_user_id,
      p.author_username,
      p.author_group,
      p.title,
      p.body,
      p.created_at,
      p.updated_at,
      COALESCE(c.comment_count, 0) AS comment_count,
      COALESCE(r.like_count, 0) AS like_count,
      COALESCE(r.dislike_count, 0) AS dislike_count
    FROM forum_posts p
    LEFT JOIN (
      SELECT post_id, COUNT(*) AS comment_count
      FROM forum_comments
      GROUP BY post_id
    ) c ON c.post_id = p.id
    LEFT JOIN (
      SELECT
        post_id,
        SUM(CASE WHEN reaction_type = 'like' THEN 1 ELSE 0 END) AS like_count,
        SUM(CASE WHEN reaction_type = 'dislike' THEN 1 ELSE 0 END) AS dislike_count
      FROM forum_reactions
      GROUP BY post_id
    ) r ON r.post_id = p.id
    WHERE p.id = ?
    LIMIT 1
    `
  ).bind(postId).first();

  if (!post) {
    return json({ success: false, error: "Post not found" }, 404);
  }

  let userReaction = null;
  let canRemove = false;

  if (session) {
    const reaction = await env.DB.prepare(
      `
      SELECT reaction_type
      FROM forum_reactions
      WHERE post_id = ? AND user_id = ?
      LIMIT 1
      `
    ).bind(postId, session.id).first();

    userReaction = reaction?.reaction_type || null;

    canRemove = canModerateForum(
      normaliseGroupName(session.group_name, Boolean(session.is_admin)),
      Boolean(session.is_admin)
    );
  }

  return json({
    success: true,
    post: {
      ...post,
      user_reaction: userReaction,
      can_remove: canRemove
    }
  });
}

async function handleForumComments(request, env) {
  await ensureCoreTables(env);

  const url = new URL(request.url);
  const postId = Number(url.searchParams.get("post_id") || "");

  if (!Number.isInteger(postId) || postId <= 0) {
    return json({ success: false, error: "A valid post id is required" }, 400);
  }

  const rows = await env.DB.prepare(
    `
    SELECT
      id,
      post_id,
      author_user_id,
      author_username,
      author_group,
      comment,
      created_at
    FROM forum_comments
    WHERE post_id = ?
    ORDER BY id ASC
    `
  ).bind(postId).all();

  return json({
    success: true,
    comments: rows.results || []
  });
}

async function handleForumCreatePost(request, env) {
  await ensureCoreTables(env);

  const session = await getApprovedUser(request, env);
  if (session instanceof Response) return session;

  const body = await safeJson(request);
  const title = cleanForumTitle(body?.title);
  const postBody = cleanForumBody(body?.body);

  if (!title) {
    return json({ success: false, error: "Post title is required" }, 400);
  }

  if (!postBody) {
    return json({ success: false, error: "Post body is required" }, 400);
  }

  const authorGroup = displayGroupName(
    normaliseGroupName(session.group_name, Boolean(session.is_admin)),
    Boolean(session.is_admin)
  );

  const now = isoNow();

  const result = await env.DB.prepare(
    `
    INSERT INTO forum_posts (
      author_user_id,
      author_username,
      author_group,
      title,
      body,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `
  ).bind(
    session.id,
    session.username,
    authorGroup,
    title,
    postBody,
    now,
    now
  ).run();

  return json({
    success: true,
    message: "Post created",
    post_id: result.meta?.last_row_id ?? null
  });
}

async function handleForumCreateComment(request, env) {
  await ensureCoreTables(env);

  const session = await getApprovedUser(request, env);
  if (session instanceof Response) return session;

  const body = await safeJson(request);
  const postId = Number(body?.post_id);
  const comment = cleanForumComment(body?.comment);

  if (!Number.isInteger(postId) || postId <= 0) {
    return json({ success: false, error: "A valid post id is required" }, 400);
  }

  if (!comment) {
    return json({ success: false, error: "Comment cannot be empty" }, 400);
  }

  const post = await env.DB.prepare(
    `SELECT id FROM forum_posts WHERE id = ? LIMIT 1`
  ).bind(postId).first();

  if (!post) {
    return json({ success: false, error: "Post not found" }, 404);
  }

  const authorGroup = displayGroupName(
    normaliseGroupName(session.group_name, Boolean(session.is_admin)),
    Boolean(session.is_admin)
  );

  const now = isoNow();

  await env.DB.prepare(
    `
    INSERT INTO forum_comments (
      post_id,
      author_user_id,
      author_username,
      author_group,
      comment,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `
  ).bind(
    postId,
    session.id,
    session.username,
    authorGroup,
    comment,
    now
  ).run();

  await env.DB.prepare(
    `
    UPDATE forum_posts
    SET updated_at = ?
    WHERE id = ?
    `
  ).bind(now, postId).run();

  return json({
    success: true,
    message: "Comment added"
  });
}

async function handleForumReact(request, env) {
  await ensureCoreTables(env);

  const session = await getApprovedUser(request, env);
  if (session instanceof Response) return session;

  const body = await safeJson(request);
  const postId = Number(body?.post_id);
  const reactionType = normaliseReactionType(body?.reaction_type);

  if (!Number.isInteger(postId) || postId <= 0) {
    return json({ success: false, error: "A valid post id is required" }, 400);
  }

  if (!reactionType) {
    return json({ success: false, error: "Reaction must be like or dislike" }, 400);
  }

  const post = await env.DB.prepare(
    `SELECT id FROM forum_posts WHERE id = ? LIMIT 1`
  ).bind(postId).first();

  if (!post) {
    return json({ success: false, error: "Post not found" }, 404);
  }

  const existing = await env.DB.prepare(
    `
    SELECT id, reaction_type
    FROM forum_reactions
    WHERE post_id = ? AND user_id = ?
    LIMIT 1
    `
  ).bind(postId, session.id).first();

  const now = isoNow();

  if (!existing) {
    await env.DB.prepare(
      `
      INSERT INTO forum_reactions (post_id, user_id, reaction_type, created_at)
      VALUES (?, ?, ?, ?)
      `
    ).bind(postId, session.id, reactionType, now).run();
  } else if (existing.reaction_type === reactionType) {
    await env.DB.prepare(
      `DELETE FROM forum_reactions WHERE id = ?`
    ).bind(existing.id).run();
  } else {
    await env.DB.prepare(
      `
      UPDATE forum_reactions
      SET reaction_type = ?, created_at = ?
      WHERE id = ?
      `
    ).bind(reactionType, now, existing.id).run();
  }

  return json({
    success: true,
    message: "Reaction updated"
  });
}

async function handleForumRemovePost(request, env) {
  await ensureCoreTables(env);

  const session = await getApprovedUser(request, env);
  if (session instanceof Response) return session;

  const group = normaliseGroupName(session.group_name, Boolean(session.is_admin));
  if (!canModerateForum(group, Boolean(session.is_admin))) {
    return json({ success: false, error: "You do not have permission to remove posts" }, 403);
  }

  const body = await safeJson(request);
  const postId = Number(body?.post_id);

  if (!Number.isInteger(postId) || postId <= 0) {
    return json({ success: false, error: "A valid post id is required" }, 400);
  }

  const existing = await env.DB.prepare(
    `SELECT id FROM forum_posts WHERE id = ? LIMIT 1`
  ).bind(postId).first();

  if (!existing) {
    return json({ success: false, error: "Post not found" }, 404);
  }

  await env.DB.prepare(`DELETE FROM forum_comments WHERE post_id = ?`).bind(postId).run();
  await env.DB.prepare(`DELETE FROM forum_reactions WHERE post_id = ?`).bind(postId).run();
  await env.DB.prepare(`DELETE FROM forum_posts WHERE id = ?`).bind(postId).run();

  return json({
    success: true,
    message: "Post removed"
  });
}

/* -------------------------------------------------------------------------- */
/*                                   ADMIN                                    */
/* -------------------------------------------------------------------------- */

async function handleAdminUsers(request, env) {
  await ensureCoreTables(env);

  const adminUser = await requireAdmin(request, env);
  if (adminUser instanceof Response) return adminUser;

  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").trim().toLowerCase();

  const rows = await env.DB.prepare(
    `
    SELECT
      u.id,
      u.username,
      u.approved,
      u.is_admin,
      u.group_name,
      u.created_at,
      u.last_seen_at,
      p.bio,
      p.avatar_url
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    ORDER BY LOWER(u.username) ASC
    `
  ).all();

  let users = (rows.results || []).map(formatAdminUserRow);

  if (search) {
    users = users.filter((user) =>
      user.username.toLowerCase().includes(search) ||
      user.group.toLowerCase().includes(search)
    );
  }

  return json({
    success: true,
    users,
    available_groups: ALLOWED_GROUPS
  });
}

async function handleAdminUser(request, env) {
  await ensureCoreTables(env);

  const adminUser = await requireAdmin(request, env);
  if (adminUser instanceof Response) return adminUser;

  const url = new URL(request.url);
  const userId = Number(url.searchParams.get("id") || "");

  if (!Number.isInteger(userId) || userId <= 0) {
    return json({ success: false, error: "A valid user id is required" }, 400);
  }

  const row = await env.DB.prepare(
    `
    SELECT
      u.id,
      u.username,
      u.approved,
      u.is_admin,
      u.group_name,
      u.created_at,
      u.last_seen_at,
      p.bio,
      p.avatar_url
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    WHERE u.id = ?
    LIMIT 1
    `
  ).bind(userId).first();

  if (!row) {
    return json({ success: false, error: "User not found" }, 404);
  }

  return json({
    success: true,
    user: formatAdminUserRow(row),
    available_groups: ALLOWED_GROUPS
  });
}

async function handleAdminPendingUsers(env, request) {
  await ensureCoreTables(env);

  const adminUser = await requireAdmin(request, env);
  if (adminUser instanceof Response) return adminUser;

  const rows = await env.DB.prepare(
    `
    SELECT
      id,
      username,
      approved,
      is_admin,
      group_name,
      created_at,
      last_seen_at
    FROM users
    WHERE approved = 0
    ORDER BY created_at ASC
    `
  ).all();

  return json({
    success: true,
    users: (rows.results || []).map(formatAdminUserRow)
  });
}

async function handleAdminUpdateUser(request, env) {
  await ensureCoreTables(env);

  const adminUser = await requireAdmin(request, env);
  if (adminUser instanceof Response) return adminUser;

  const body = await safeJson(request);

  const userId = Number(body?.user_id);
  const approved = body?.approved;
  const isAdmin = body?.is_admin;
  const requestedGroup = sanitiseGroupName(body?.group_name);

  if (!Number.isInteger(userId) || userId <= 0) {
    return json({ success: false, error: "A valid user id is required" }, 400);
  }

  if (!requestedGroup) {
    return json({ success: false, error: "A valid group is required" }, 400);
  }

  const existingUser = await env.DB.prepare(
    `
    SELECT id, username, is_admin, group_name
    FROM users
    WHERE id = ?
    LIMIT 1
    `
  ).bind(userId).first();

  if (!existingUser) {
    return json({ success: false, error: "User not found" }, 404);
  }

  if (existingUser.id === adminUser.id && approved === false) {
    return json({ success: false, error: "You cannot unapprove your own account" }, 400);
  }

  const nextIsAdmin = Boolean(isAdmin) || requestedGroup === "admin";
  const nextApproved = approved === undefined ? true : Boolean(approved);
  const nextGroup = requestedGroup === "admin" ? "admin" : requestedGroup;

  await env.DB.prepare(
    `
    UPDATE users
    SET approved = ?, is_admin = ?, group_name = ?
    WHERE id = ?
    `
  ).bind(nextApproved ? 1 : 0, nextIsAdmin ? 1 : 0, nextGroup, userId).run();

  const updatedRow = await env.DB.prepare(
    `
    SELECT
      u.id,
      u.username,
      u.approved,
      u.is_admin,
      u.group_name,
      u.created_at,
      u.last_seen_at,
      p.bio,
      p.avatar_url
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    WHERE u.id = ?
    LIMIT 1
    `
  ).bind(userId).first();

  return json({
    success: true,
    message: "User updated successfully",
    user: formatAdminUserRow(updatedRow)
  });
}

async function requireAdmin(request, env) {
  const session = await getSessionUser(request, env);

  if (!session) {
    return json({ success: false, error: "Not authenticated" }, 401);
  }

  if (!Boolean(session.is_admin)) {
    return json({ success: false, error: "Admin access required" }, 403);
  }

  return session;
}

/* -------------------------------------------------------------------------- */
/*                                  SESSION                                   */
/* -------------------------------------------------------------------------- */

async function getSessionUser(request, env) {
  const cookies = parseCookies(request.headers.get("Cookie") || "");
  const sessionToken = cookies[SESSION_COOKIE_NAME];

  if (!sessionToken) {
    return null;
  }

  const row = await env.DB.prepare(
    `
    SELECT
      u.id,
      u.username,
      u.approved,
      u.is_admin,
      u.group_name,
      u.last_seen_at,
      p.bio,
      p.avatar_url,
      s.session_token,
      s.expires_at
    FROM sessions s
    INNER JOIN users u ON u.id = s.user_id
    LEFT JOIN user_profiles p ON p.user_id = u.id
    WHERE s.session_token = ?
    LIMIT 1
    `
  ).bind(sessionToken).first();

  if (!row) {
    return null;
  }

  const expiresAt = Date.parse(row.expires_at);
  if (Number.isNaN(expiresAt) || expiresAt < Date.now()) {
    await env.DB.prepare(`DELETE FROM sessions WHERE session_token = ?`)
      .bind(sessionToken)
      .run();
    return null;
  }

  return row;
}

async function getApprovedUser(request, env) {
  const session = await getSessionUser(request, env);

  if (!session) {
    return json({ success: false, error: "Not authenticated" }, 401);
  }

  if (!Boolean(session.approved)) {
    return json({ success: false, error: "Account is not approved" }, 403);
  }

  return session;
}

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders()
    }
  });
}

function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(),
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": "true"
  };
}

async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader) {
  const out = {};
  const parts = cookieHeader.split(";");

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    out[key] = decodeURIComponent(value);
  }

  return out;
}

function buildSessionCookie(sessionToken, expires) {
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Expires=${expires.toUTCString()}`
  ].join("; ");
}

function clearSessionCookie() {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT"
  ].join("; ");
}

function cleanUsername(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, 32);
}

function cleanMessage(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim().slice(0, 1000);
}

function cleanForumTitle(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, 140);
}

function cleanForumBody(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim().slice(0, 12000);
}

function cleanForumComment(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim().slice(0, 3000);
}

function normaliseReactionType(value) {
  if (typeof value !== "string") return "";
  const cleaned = value.trim().toLowerCase();
  return cleaned === "like" || cleaned === "dislike" ? cleaned : "";
}

function sanitiseGroupName(value) {
  if (typeof value !== "string") return "";
  const cleaned = value.trim().toLowerCase();
  return ALLOWED_GROUPS.includes(cleaned) ? cleaned : "";
}

function normaliseGroupName(groupName, isAdmin = false) {
  if (isAdmin) return "admin";
  const cleaned = sanitiseGroupName(groupName);
  return cleaned || DEFAULT_USER_GROUP;
}

function buildUserGroups(groupName, isAdmin = false) {
  const groups = new Set();
  if (groupName) groups.add(groupName);
  if (isAdmin) groups.add("admin");
  return [...groups];
}

function displayGroupName(groupName, isAdmin = false) {
  const finalGroup = normaliseGroupName(groupName, isAdmin);
  if (finalGroup === "admin") return "Admin";
  if (finalGroup === "dev") return "Dev";
  if (finalGroup === "staff") return "Staff";
  if (finalGroup === "mod") return "Mod";
  if (finalGroup === "higher") return "Higher";
  if (finalGroup === "member") return "Member";
  return "Standard";
}

function canModerateForum(groupName, isAdmin = false) {
  if (isAdmin) return true;
  return MODERATION_GROUPS.has(normaliseGroupName(groupName, isAdmin));
}

function formatAdminUserRow(row) {
  const group = normaliseGroupName(row.group_name, Boolean(row.is_admin));
  return {
    id: row.id,
    username: row.username,
    approved: Boolean(row.approved),
    is_admin: Boolean(row.is_admin),
    group,
    groups: buildUserGroups(group, Boolean(row.is_admin)),
    created_at: row.created_at || null,
    last_seen_at: row.last_seen_at || null,
    bio: row.bio || "",
    avatar_url: row.avatar_url || ""
  };
}

function isoNow() {
  return new Date().toISOString();
}

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bufferToHex(digest);
}

async function verifyPassword(password, storedHash) {
  const calculated = await hashPassword(password);
  return calculated === storedHash;
}

function bufferToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}