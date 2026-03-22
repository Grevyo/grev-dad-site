import test from "node:test";
import assert from "node:assert/strict";
import { validateContactPayload } from "../src/worker/lib/validate.js";
import worker from "../src/worker/index.js";

test("validateContactPayload accepts a complete payload", () => {
  const result = validateContactPayload({ name: "Grev Dad", email: "grev@example.com", message: "Hello" });
  assert.equal(result.ok, true);
});

test("worker contact route acknowledges valid submissions", async () => {
  const request = new Request("https://example.com/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Grev Dad", email: "grev@example.com", message: "Hello" })
  });
  const response = await worker.fetch(request, {}, {});
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.success, true);
});
