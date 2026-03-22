import { json } from "../lib/response.js";
import { validateContactPayload } from "../lib/validate.js";

// The current implementation validates and acknowledges messages without depending on extra services.
export async function handleContact(request) {
  const payload = await request.json().catch(() => null);
  const result = validateContactPayload(payload);
  if (!result.ok) {
    return json({ success: false, error: result.error }, 400);
  }

  return json({
    success: true,
    message: `Thanks ${result.value.name}, your message has been received.`,
    received_at: new Date().toISOString()
  }, 200);
}
