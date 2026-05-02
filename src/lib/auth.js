import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function normalizeUsername(raw) { return String(raw || "").trim().toLowerCase(); }
export function hashPassword(password) { const salt = randomBytes(16).toString("hex"); return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`; }
export function verifyPassword(password, stored) { const [salt, hash] = String(stored).split(":"); if (!salt || !hash) return false; return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(scryptSync(password, salt, 64).toString("hex"), "hex")); }
export function hashToken(token) { return createHash("sha256").update(token).digest("hex"); }
export function createSessionToken() { return randomBytes(32).toString("hex"); }
export function sanitizeUser(user) { return { id: user.id, username: user.username, role: user.role, isAdmin: Number(user.is_admin) === 1 }; }
