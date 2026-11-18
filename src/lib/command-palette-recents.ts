export const COMMAND_PALETTE_RECENTS_KEY = "command_palette_recents_v1";
export const COMMAND_PALETTE_RECENTS_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const COMMAND_PALETTE_MAX_RECENTS = 8;

export type CommandPaletteRecentKind =
  | "module"
  | "record"
  | "department"
  | "document";

export interface CommandPaletteRecent {
  id: string;
  kind: CommandPaletteRecentKind;
  title: string;
  subtitle?: string | null;
  href: string;
  moduleKey?: string | null;
  deptKey?: string | null;
  /** Epoch milliseconds. */
  at: number;
}

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecent(value: unknown): value is CommandPaletteRecent {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.href === "string" &&
    typeof row.title === "string" &&
    typeof row.at === "number" &&
    ["module", "record", "department", "document"].includes(
      row.kind as string,
    )
  );
}

/** Load recents newest-first, dropping expired and malformed entries. */
export function loadCommandPaletteRecents(
  storage?: StorageLike,
  now = Date.now(),
): CommandPaletteRecent[] {
  const target = resolveStorage(storage);
  if (!target) return [];

  try {
    const raw = target.getItem(COMMAND_PALETTE_RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(isRecent)
      .filter((row) => now - row.at <= COMMAND_PALETTE_RECENTS_TTL_MS)
      .sort((a, b) => b.at - a.at)
      .slice(0, COMMAND_PALETTE_MAX_RECENTS);
  } catch {
    return [];
  }
}

/** Insert or move an entry to the top, capped and expiry-filtered. */
export function saveCommandPaletteRecent(
  entry: Omit<CommandPaletteRecent, "at"> & { at?: number },
  storage?: StorageLike,
  now = Date.now(),
): CommandPaletteRecent[] {
  const target = resolveStorage(storage);
  const next = [
    { ...entry, at: entry.at ?? now },
    ...loadCommandPaletteRecents(target ?? undefined, now).filter(
      (row) => !(row.kind === entry.kind && row.id === entry.id),
    ),
  ].slice(0, COMMAND_PALETTE_MAX_RECENTS);

  if (target) {
    try {
      target.setItem(COMMAND_PALETTE_RECENTS_KEY, JSON.stringify(next));
    } catch {
      // Quota or privacy mode: recents are a convenience, not state.
    }
  }

  return next;
}

export function clearCommandPaletteRecents(storage?: StorageLike): void {
  const target = resolveStorage(storage);
  try {
    target?.removeItem(COMMAND_PALETTE_RECENTS_KEY);
  } catch {
    // Ignore storage failures.
  }
}
