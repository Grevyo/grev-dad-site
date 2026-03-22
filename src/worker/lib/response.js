// Shared response helpers keep API handlers concise and consistent.
export function json(data, status = 200, init = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      ...init.headers
    },
    ...init
  });
}
