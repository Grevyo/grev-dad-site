import { getCachedValue, invalidateCachedPrefix } from '../lib/runtime-cache.js';
import { ensureBlackjackTables } from './schema.js';
import { getStartingBalancePence } from '../lib/gambling.js';

const BOT_NAMES = [
  'Chippy McShuffle',
  'Sir Hits-a-Lot',
  'Lady DoubleDown',
  'Professor Pancake',
  'Count Cardula',
  'Bingo Bongo',
  'Captain Cautious',
  'Grevtron 9000',
  'Mildly Suspicious Dave',
  'The Honk Baron'
];

function buildDeck(decks = 4) {
  const cards = [];
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const suits = ['spades','hearts','diamonds','clubs'];
  for (let d = 0; d < decks; d += 1) {
    for (const suit of suits) for (const rank of ranks) cards.push({ rank, suit });
  }
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
function cardValue(rank) { if (rank === 'A') return 11; if (['J','Q','K'].includes(rank)) return 10; return Number(rank); }
function scoreHand(cards = []) {
  let total = cards.reduce((sum, c) => sum + cardValue(c.rank), 0);
  let aces = cards.filter((c) => c.rank === 'A').length;
  while (total > 21 && aces > 0) { total -= 10; aces -= 1; }
  return { total, soft: aces > 0 };
}
function getBoostMultiplier(boostPercent = 0) { return 1 + Math.max(0, Number(boostPercent || 0)) / 100; }
async function getBoost(env) {
  const row = await getCachedValue('casesdb:event-config', 30000, async () => await env.CASES_DB.prepare(`SELECT is_active, blackjack_bonus_percent FROM gambling_event_config WHERE id = 1 LIMIT 1`).first().catch(() => null));
  return row && Number(row.is_active) ? Number(row.blackjack_bonus_percent || 0) : 0;
}
function funnyBotName(index, difficulty) {
  const base = BOT_NAMES[index % BOT_NAMES.length];
  const diff = String(difficulty || 'medium');
  return `${base} (${diff[0].toUpperCase()}${diff.slice(1)} bot)`;
}
function normaliseRoomState(room) {
  const state = JSON.parse(room.room_state || '{}');
  const maxPlayers = [4, 6, 8].includes(Number(room.max_players)) ? Number(room.max_players) : 4;
  const players = Array.isArray(state.players) ? state.players : [];
  const spectators = Array.isArray(state.spectators) ? state.spectators : [];
  const seats = Array.from({ length: maxPlayers }, (_, seatIndex) => {
    const exact = players.find((player) => Number(player.seat_index) === seatIndex);
    if (exact) return exact;
    return null;
  });
  players.forEach((player) => {
    if (Number.isInteger(player.seat_index) && player.seat_index >= 0 && player.seat_index < maxPlayers && !seats[player.seat_index]) {
      seats[player.seat_index] = player;
    }
  });
  return {
    ...state,
    seats,
    players: seats.filter(Boolean),
    spectators,
    dealer: state.dealer && Array.isArray(state.dealer.cards) ? state.dealer : { cards: [] },
    deck: Array.isArray(state.deck) ? state.deck : [],
    event_log: Array.isArray(state.event_log) ? state.event_log : []
  };
}
async function getRoom(db, roomId) {
  const row = await db.prepare(`SELECT * FROM blackjack_rooms WHERE id = ? LIMIT 1`).bind(roomId).first();
  if (!row) return null;
  return { ...row, room_state: normaliseRoomState(row) };
}
async function saveRoom(db, roomId, status, state, now) {
  await db.prepare(`UPDATE blackjack_rooms SET status = ?, room_state = ?, updated_at = ? WHERE id = ?`).bind(status, JSON.stringify(state), now, roomId).run();
}
function addLog(state, message, now) {
  state.event_log = Array.isArray(state.event_log) ? state.event_log : [];
  state.event_log.unshift({ message, at: now });
  state.event_log = state.event_log.slice(0, 24);
}
function botWantsHit(bot, dealerUp) {
  const total = scoreHand(bot.cards).total;
  const difficulty = bot.difficulty || 'medium';
  if (difficulty === 'easy') return total < 15;
  if (difficulty === 'hard') return total < (dealerUp >= 7 ? 17 : 12);
  return total < 16;
}
function findSeat(state, session) {
  return state.players.find((player) => !player.is_bot && Number(player.user_id) === Number(session.id)) || null;
}
async function maybeFinishRound(env, db, room, now) {
  const state = room.room_state;
  const activeHumans = state.players.filter((p) => !p.is_bot && !p.busted && !p.standing);
  const dealerUp = state.dealer.cards[0] ? scoreHand([state.dealer.cards[0]]).total : 0;
  for (const bot of state.players.filter((p) => p.is_bot && !p.busted && !p.standing)) {
    while (botWantsHit(bot, dealerUp)) {
      bot.cards.push(state.deck.pop());
      addLog(state, `${bot.username} draws a card.`, now);
      const total = scoreHand(bot.cards).total;
      if (total > 21) { bot.busted = true; addLog(state, `${bot.username} busts with ${total}.`, now); break; }
      if (!botWantsHit(bot, dealerUp)) bot.standing = true;
    }
    if (!bot.busted) { bot.standing = true; addLog(state, `${bot.username} stands on ${scoreHand(bot.cards).total}.`, now); }
  }
  const everyoneDone = state.players.every((p) => p.busted || p.standing);
  if (!everyoneDone && activeHumans.length) {
    await saveRoom(db, room.id, 'active', state, now);
    return room;
  }
  while (scoreHand(state.dealer.cards).total < 17) {
    state.dealer.cards.push(state.deck.pop());
    addLog(state, `Dealer draws a card.`, now);
  }
  const dealerScore = scoreHand(state.dealer.cards).total;
  const boost = await getBoost(env);
  for (const player of state.players.filter((p) => !p.is_bot)) {
    const playerScore = scoreHand(player.cards).total;
    let payout = 0;
    if (player.busted) payout = 0;
    else if (dealerScore > 21 || playerScore > dealerScore) payout = Math.round(player.bet_pence * 2 + player.bet_pence * getBoostMultiplier(boost) - player.bet_pence);
    else if (playerScore === dealerScore) payout = player.bet_pence;
    if (payout > 0) await env.CASES_DB.prepare(`UPDATE case_profiles SET balance = balance + ?, updated_at = ? WHERE user_id = ?`).bind(payout, now, player.user_id).run();
    player.result = payout > player.bet_pence ? 'win' : payout === player.bet_pence ? 'push' : 'lose';
    player.payout_pence = payout;
    addLog(state, `${player.username} ${player.result}s${payout ? ` for ${payout} GC cents` : ''}.`, now);
  }
  state.finished_at = now;
  await saveRoom(db, room.id, 'finished', state, now);
  return { ...room, status: 'finished', room_state: state };
}

export async function handleBlackjackRequest(request, env, deps) {
  const { json, getApprovedUser, safeJson, isoNow } = deps;
  const url = new URL(request.url);
  const { pathname } = url;
  if (!pathname.startsWith('/api/blackjack')) return null;
  const db = await ensureBlackjackTables(env);
  if (!db || !env.CASES_DB) return json({ success: false, error: 'BLACKJACK_DB/CASES_DB is not configured' }, 500, request);
  const session = await getApprovedUser(request, env);
  if (session instanceof Response) return session;
  await env.CASES_DB.prepare(`INSERT OR IGNORE INTO case_profiles (user_id, display_name, balance, total_cases_opened, total_spent, total_inventory_value, created_at, updated_at) VALUES (?, ?, ?, 0, 0, 0, ?, ?)`).bind(session.id, session.username, await getStartingBalancePence(env), isoNow(), isoNow()).run();

  if (pathname === '/api/blackjack/rooms' && request.method === 'GET') {
    const rows = await db.prepare(`SELECT id, room_name, owner_user_id, bet_pence, status, max_players, room_state, updated_at FROM blackjack_rooms ORDER BY updated_at DESC LIMIT 50`).all();
    const rooms = (rows.results || []).map((row) => {
      const state = normaliseRoomState(row);
      return {
        id: row.id,
        room_name: row.room_name,
        bet_pence: Number(row.bet_pence || 0),
        status: row.status,
        max_players: Number(row.max_players || 4),
        player_count: state.players.length,
        players: state.players.map((p) => ({ username: p.username, difficulty: p.difficulty || null, is_bot: Boolean(p.is_bot), seat_index: p.seat_index })),
        spectators: state.spectators.map((s) => ({ user_id: s.user_id, username: s.username })),
        updated_at: row.updated_at
      };
    });
    return json({ success: true, rooms }, 200, request);
  }
  if (pathname === '/api/blackjack/room' && request.method === 'GET') {
    const roomId = Number(url.searchParams.get('room_id') || 0);
    const room = await getRoom(db, roomId);
    if (!room) return json({ success: false, error: 'Room not found' }, 404, request);
    return json({ success: true, room }, 200, request);
  }
  if (pathname === '/api/blackjack/rooms/create' && request.method === 'POST') {
    const body = await safeJson(request);
    const roomName = String(body?.room_name || '').trim() || `${session.username}'s table`;
    const botCount = Math.max(0, Math.min(7, Number(body?.bot_count || 0)));
    const botDifficulty = String(body?.bot_difficulty || 'medium');
    const maxPlayers = [4, 6, 8].includes(Number(body?.max_players)) ? Number(body.max_players) : 4;
    const betPence = Math.max(100, Math.round(Number(body?.bet_pence || 100)));
    const now = isoNow();
    const seats = Array.from({ length: maxPlayers }, () => null);
    seats[0] = { user_id: session.id, username: session.username, is_bot: false, cards: [], standing: false, busted: false, bet_pence: betPence, seat_index: 0 };
    let botCursor = 0;
    for (let i = 1; i < maxPlayers && botCursor < botCount; i += 1, botCursor += 1) seats[i] = { user_id: null, username: funnyBotName(botCursor, botDifficulty), is_bot: true, difficulty: botDifficulty, cards: [], standing: false, busted: false, bet_pence: betPence, seat_index: i };
    const state = { seats, players: seats.filter(Boolean), spectators: [], dealer: { cards: [] }, deck: [], bot_difficulty: botDifficulty, event_log: [] };
    addLog(state, `${session.username} opens the room.`, now);
    const result = await db.prepare(`INSERT INTO blackjack_rooms (room_name, owner_user_id, bet_pence, status, max_players, room_state, created_at, updated_at) VALUES (?, ?, ?, 'waiting', ?, ?, ?, ?)`).bind(roomName, session.id, betPence, maxPlayers, JSON.stringify(state), now, now).run();
    invalidateCachedPrefix('blackjack:rooms');
    return json({ success: true, room_id: Number(result.meta?.last_row_id || 0) }, 200, request);
  }
  if (pathname === '/api/blackjack/rooms/join' && request.method === 'POST') {
    const body = await safeJson(request); const roomId = Number(body?.room_id || 0); const seatIndex = Number(body?.seat_index);
    const room = await getRoom(db, roomId); if (!room) return json({ success: false, error: 'Room not found' }, 404, request);
    const state = room.room_state; if (room.status !== 'waiting') return json({ success: false, error: 'Room already started' }, 400, request);
    if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= Number(room.max_players || state.seats.length)) return json({ success: false, error: 'Invalid seat' }, 400, request);
    const existingSeat = findSeat(state, session);
    if (existingSeat) return json({ success: true, room: { ...room, room_state: state } }, 200, request);
    if (state.seats[seatIndex]) return json({ success: false, error: 'Seat already taken' }, 400, request);
    state.spectators = state.spectators.filter((spectator) => Number(spectator.user_id) !== Number(session.id));
    state.seats[seatIndex] = { user_id: session.id, username: session.username, is_bot: false, cards: [], standing: false, busted: false, bet_pence: Number(room.bet_pence || 100), seat_index: seatIndex };
    state.players = state.seats.filter(Boolean);
    addLog(state, `${session.username} sits in seat ${seatIndex + 1}.`, isoNow());
    await saveRoom(db, roomId, 'waiting', state, isoNow());
    return json({ success: true, room: { ...room, room_state: state } }, 200, request);
  }
  if (pathname === '/api/blackjack/rooms/leave' && request.method === 'POST') {
    const body = await safeJson(request); const roomId = Number(body?.room_id || 0);
    const room = await getRoom(db, roomId); if (!room) return json({ success: false, error: 'Room not found' }, 404, request);
    if (room.status !== 'waiting') return json({ success: false, error: 'You can only stand up before a round starts' }, 400, request);
    const state = room.room_state;
    const seat = findSeat(state, session);
    if (!seat) return json({ success: false, error: 'You are not seated' }, 400, request);
    state.seats[seat.seat_index] = null;
    state.players = state.seats.filter(Boolean);
    addLog(state, `${session.username} stands up from the table.`, isoNow());
    await saveRoom(db, roomId, 'waiting', state, isoNow());
    return json({ success: true, room: { ...room, room_state: state } }, 200, request);
  }
  if (pathname === '/api/blackjack/rooms/spectate' && request.method === 'POST') {
    const body = await safeJson(request); const roomId = Number(body?.room_id || 0);
    const room = await getRoom(db, roomId); if (!room) return json({ success: false, error: 'Room not found' }, 404, request);
    const state = room.room_state;
    if (!findSeat(state, session) && !state.spectators.find((spectator) => Number(spectator.user_id) === Number(session.id))) {
      state.spectators.push({ user_id: session.id, username: session.username, joined_at: isoNow() });
      addLog(state, `${session.username} starts spectating.`, isoNow());
      await saveRoom(db, roomId, room.status, state, isoNow());
    }
    return json({ success: true, room: { ...room, room_state: state } }, 200, request);
  }
  if (pathname === '/api/blackjack/rooms/start' && request.method === 'POST') {
    const body = await safeJson(request); const roomId = Number(body?.room_id || 0); const room = await getRoom(db, roomId);
    if (!room) return json({ success: false, error: 'Room not found' }, 404, request);
    if (Number(room.owner_user_id) !== Number(session.id)) return json({ success: false, error: 'Only the room owner can start the game' }, 403, request);
    const state = room.room_state; const betPence = Number(room.bet_pence || 100);
    for (const player of state.players.filter((p) => !p.is_bot)) {
      const bal = await env.CASES_DB.prepare(`SELECT balance FROM case_profiles WHERE user_id = ? LIMIT 1`).bind(player.user_id).first();
      if (Number(bal?.balance || 0) < betPence) return json({ success: false, error: `${player.username} does not have enough Grev Coins.` }, 400, request);
    }
    for (const player of state.players.filter((p) => !p.is_bot)) await env.CASES_DB.prepare(`UPDATE case_profiles SET balance = balance - ?, updated_at = ? WHERE user_id = ?`).bind(betPence, isoNow(), player.user_id).run();
    state.deck = buildDeck(4);
    state.dealer = { cards: [state.deck.pop(), state.deck.pop()] };
    state.players = state.seats.filter(Boolean).map((p) => ({ ...p, cards: [state.deck.pop(), state.deck.pop()], standing: false, busted: false, bet_pence: betPence, result: null, payout_pence: 0 }));
    state.seats = Array.from({ length: Number(room.max_players || 4) }, (_, i) => state.players.find((player) => Number(player.seat_index) === i) || null);
    addLog(state, `Round started with ${state.players.length} seated player${state.players.length === 1 ? '' : 's'}.`, isoNow());
    await saveRoom(db, roomId, 'active', state, isoNow());
    const updated = await maybeFinishRound(env, db, { ...room, status: 'active', room_state: state }, isoNow());
    return json({ success: true, room: updated }, 200, request);
  }
  if (pathname === '/api/blackjack/action' && request.method === 'POST') {
    const body = await safeJson(request); const roomId = Number(body?.room_id || 0); const action = String(body?.action || '');
    const room = await getRoom(db, roomId); if (!room) return json({ success: false, error: 'Room not found' }, 404, request);
    if (room.status !== 'active') return json({ success: false, error: 'Room is not active' }, 400, request);
    const player = room.room_state.players.find((p) => !p.is_bot && Number(p.user_id) === Number(session.id));
    if (!player) return json({ success: false, error: 'You are not seated at this table' }, 403, request);
    if (player.standing || player.busted) return json({ success: false, error: 'Your hand is already finished' }, 400, request);
    if (action === 'hit') {
      player.cards.push(room.room_state.deck.pop());
      addLog(room.room_state, `${player.username} hits.`, isoNow());
      if (scoreHand(player.cards).total > 21) { player.busted = true; addLog(room.room_state, `${player.username} busts.`, isoNow()); }
    } else if (action === 'stand') { player.standing = true; addLog(room.room_state, `${player.username} stands.`, isoNow()); }
    else return json({ success: false, error: 'Unknown action' }, 400, request);
    room.room_state.seats[player.seat_index] = player;
    const updated = await maybeFinishRound(env, db, room, isoNow());
    return json({ success: true, room: updated }, 200, request);
  }
  return json({ success: false, error: 'Unknown blackjack route' }, 404, request);
}
