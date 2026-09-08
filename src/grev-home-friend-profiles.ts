import { handleGrevHomeRequest, type GrevHomeEnv } from './grev-home';

type FriendPayload = Record<string, unknown> & { userId?: unknown; publicCard?: unknown };
type FriendsPayload = Record<string, unknown> & { friends?: unknown };
type AggregateRow = {
  user_id: string;
  total_tracked_seconds: number;
  completed_sessions: number;
};

function jsonFrom(response: Response, value: unknown): Response {
  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(value), { status: response.status, headers });
}

/**
 * Enriches the established Grev Home friends response with account-wide Grev Home activity
 * totals. The underlying handler remains authoritative for authentication, friendship/block
 * rules, presence, shared XP and public-card sanitisation; this layer only adds statistics that
 * are already stored by the existing Grev Home sync/restore contract.
 */
export async function handleGrevHomeFriendProfiles(
  request: Request,
  env: GrevHomeEnv
): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.pathname !== '/api/grev-home/friends') return null;

  const response = await handleGrevHomeRequest(request, env);
  if (!response || !response.ok) return response;

  const payload = await response.json() as FriendsPayload;
  const friends = Array.isArray(payload.friends)
    ? payload.friends.filter(item => item && typeof item === 'object') as FriendPayload[]
    : [];
  const userIds = [...new Set(friends
    .map(friend => typeof friend.userId === 'string' ? friend.userId : '')
    .filter(Boolean))];

  if (userIds.length === 0) {
    return jsonFrom(response, { ...payload, friends });
  }

  const placeholders = userIds.map(() => '?').join(',');
  const aggregates = await env.DB.prepare(`
    SELECT user_id,
      COALESCE(SUM(total_seconds),0) AS total_tracked_seconds,
      COALESCE(SUM(completed_sessions),0) AS completed_sessions
    FROM grev_home_profile_sources
    WHERE user_id IN (${placeholders})
    GROUP BY user_id
  `).bind(...userIds).all<AggregateRow>();

  const byUser = new Map(aggregates.results.map(row => [row.user_id, row]));
  return jsonFrom(response, {
    ...payload,
    friends: friends.map(friend => {
      const userId = typeof friend.userId === 'string' ? friend.userId : '';
      const aggregate = byUser.get(userId);
      const totalTrackedSeconds = Math.max(0, Number(aggregate?.total_tracked_seconds ?? 0));
      const completedSessions = Math.max(0, Number(aggregate?.completed_sessions ?? 0));
      const publicCard = friend.publicCard && typeof friend.publicCard === 'object' && !Array.isArray(friend.publicCard)
        ? friend.publicCard as Record<string, unknown>
        : {};
      return {
        ...friend,
        totalTrackedSeconds,
        completedSessions,
        publicCard: { ...publicCard, totalTrackedSeconds, completedSessions }
      };
    })
  });
}
