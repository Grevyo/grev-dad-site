export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

export async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
