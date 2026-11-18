import {
  COMMAND_PALETTE_MAX_RECENTS,
  COMMAND_PALETTE_RECENTS_KEY,
  COMMAND_PALETTE_RECENTS_TTL_MS,
  clearCommandPaletteRecents,
  loadCommandPaletteRecents,
  saveCommandPaletteRecent,
  type CommandPaletteRecent,
} from "@/lib/command-palette-recents";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

function recent(
  id: string,
  overrides: Partial<CommandPaletteRecent> = {},
): CommandPaletteRecent {
  return {
    id,
    kind: "record",
    title: `Record ${id}`,
    subtitle: "Subtitle",
    href: `/dept/sales/contacts?open=${id}`,
    moduleKey: "contacts",
    deptKey: "sales",
    at: Date.now(),
    ...overrides,
  };
}

describe("command palette recents", () => {
  it("returns an empty list for malformed storage", () => {
    const storage = memoryStorage();
    storage.setItem(COMMAND_PALETTE_RECENTS_KEY, "{not json");

    expect(loadCommandPaletteRecents(storage)).toEqual([]);
  });

  it("drops entries older than 30 days", () => {
    const storage = memoryStorage();
    const now = Date.now();
    storage.setItem(
      COMMAND_PALETTE_RECENTS_KEY,
      JSON.stringify([
        recent("fresh", { at: now - 1_000 }),
        recent("stale", { at: now - COMMAND_PALETTE_RECENTS_TTL_MS - 1 }),
      ]),
    );

    expect(loadCommandPaletteRecents(storage, now).map((row) => row.id)).toEqual(
      ["fresh"],
    );
  });

  it("dedupes by kind and id and moves the selection to the top", () => {
    const storage = memoryStorage();
    const now = Date.now();

    saveCommandPaletteRecent(recent("a", { at: now - 5_000 }), storage, now);
    saveCommandPaletteRecent(recent("b", { at: now - 4_000 }), storage, now);
    saveCommandPaletteRecent(recent("a", { at: now }), storage, now);

    const rows = loadCommandPaletteRecents(storage, now);
    expect(rows.map((row) => row.id)).toEqual(["a", "b"]);
  });

  it("caps the list at eight entries", () => {
    const storage = memoryStorage();
    const now = Date.now();

    for (let index = 0; index < 12; index += 1) {
      saveCommandPaletteRecent(recent(`r-${index}`, { at: now + index }), storage, now);
    }

    expect(loadCommandPaletteRecents(storage, now)).toHaveLength(
      COMMAND_PALETTE_MAX_RECENTS,
    );
  });

  it("clears storage", () => {
    const storage = memoryStorage();
    saveCommandPaletteRecent(recent("a"), storage);
    clearCommandPaletteRecents(storage);

    expect(storage.getItem(COMMAND_PALETTE_RECENTS_KEY)).toBeNull();
  });
});
