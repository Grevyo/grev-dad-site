// Live profile widgets: tiles that show data (recent games, best friends, RetroAchievements...)
// instead of text the owner typed. A widget tile is stored as a 'text' tile with a widget kind
// and a small config, so it keeps the grid rules every other tile follows and an older client
// shows it as a plain titled tile rather than dropping it.
//
// This file is only the tile contract (kinds, config, validation). Resolving a widget to data for
// a particular viewer is src/profile-unified.ts. Grev Home's ProfileWidgetKind mirrors this list.

export const PROFILE_WIDGETS = [
  'recent-games',
  'game-activity',
  'most-played',
  'favourite-games',
  'best-friends',
  'bio',
  'stats',
  'achievements',
  'retroachievements'
] as const;

export type ProfileWidget = typeof PROFILE_WIDGETS[number];
export type WidgetConfig = { count?: number };

export const MIN_WIDGET_ITEMS = 1;
export const MAX_WIDGET_ITEMS = 12;

const WIDGET_SET = new Set<string>(PROFILE_WIDGETS);

// Widgets that show a list; the rest ignore count.
const LIST_WIDGETS = new Set<ProfileWidget>([
  'recent-games', 'game-activity', 'most-played', 'favourite-games', 'best-friends', 'achievements', 'retroachievements'
]);

export const DEFAULT_WIDGET_COUNT: Record<ProfileWidget, number> = {
  'recent-games': 6,
  'game-activity': 5,
  'most-played': 5,
  'favourite-games': 6,
  'best-friends': 6,
  bio: 0,
  stats: 0,
  achievements: 6,
  retroachievements: 5
};

export function isProfileWidget(value: unknown): value is ProfileWidget {
  return typeof value === 'string' && WIDGET_SET.has(value);
}

export function widgetCount(widget: ProfileWidget, config: WidgetConfig): number {
  const count = config.count ?? DEFAULT_WIDGET_COUNT[widget];
  return Math.min(MAX_WIDGET_ITEMS, Math.max(MIN_WIDGET_ITEMS, count));
}

/**
 * Validates the widget half of a tile from client input. null/absent widget = a plain tile.
 * Returns undefined when the input is invalid (an unknown kind or an out-of-range count), so the
 * whole tile is rejected the same way any other invalid tile field rejects it.
 */
export function widgetFromInput(
  widgetValue: unknown,
  configValue: unknown
): { widget: ProfileWidget | null; widgetConfig: WidgetConfig } | undefined {
  if (widgetValue === null || widgetValue === undefined || widgetValue === '') return { widget: null, widgetConfig: {} };
  if (!isProfileWidget(widgetValue)) return undefined;
  if (configValue !== null && configValue !== undefined && (typeof configValue !== 'object' || Array.isArray(configValue))) return undefined;
  const input = (configValue ?? {}) as Record<string, unknown>;
  const widgetConfig: WidgetConfig = {};
  if (input.count !== undefined && input.count !== null && LIST_WIDGETS.has(widgetValue)) {
    const count = Number(input.count);
    if (!Number.isInteger(count) || count < MIN_WIDGET_ITEMS || count > MAX_WIDGET_ITEMS) return undefined;
    widgetConfig.count = count;
  }
  return { widget: widgetValue, widgetConfig };
}

/** Reads the stored columns back; anything unrecognised degrades to a plain tile. */
export function widgetFromRow(
  widget: string | null | undefined,
  config: string | null | undefined
): { widget: ProfileWidget | null; widgetConfig: WidgetConfig } {
  if (!isProfileWidget(widget)) return { widget: null, widgetConfig: {} };
  let parsed: unknown = {};
  try { parsed = JSON.parse(config || '{}'); } catch { parsed = {}; }
  return widgetFromInput(widget, parsed) ?? { widget, widgetConfig: {} };
}
