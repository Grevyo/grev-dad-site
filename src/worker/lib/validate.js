// Lightweight validation helpers for the new worker handlers.
export function isNonEmptyString(value, maxLength = Infinity) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

export function validateContactPayload(payload) {
  const name = typeof payload?.name === "string" ? payload.name.trim() : "";
  const email = typeof payload?.email === "string" ? payload.email.trim() : "";
  const message = typeof payload?.message === "string" ? payload.message.trim() : "";

  if (!isNonEmptyString(name, 80)) return { ok: false, error: "Please enter your name." };
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 120) return { ok: false, error: "Please enter a valid email address." };
  if (!isNonEmptyString(message, 4000)) return { ok: false, error: "Please enter a message." };

  return { ok: true, value: { name, email, message } };
}
