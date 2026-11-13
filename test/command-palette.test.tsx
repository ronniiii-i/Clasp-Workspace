import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "./utils/renderers";
import { saveCommandPaletteRecent } from "@/lib/command-palette-recents";
import type { Module } from "@/lib/modules";

const mockPush = jest.fn();
const mockSearch = jest.fn();
const mockModules: Module[] = [
  {
    id: "module-project-management",
    key: "project-management",
    name: "Project Management",
    path: "/dept/operations/project-management",
    icon: "layout-dashboard",
    order: 0,
    actions: ["VIEW", "CREATE"],
    type: "DATA_TABLE",
    group: "Operations",
    department: {
      id: "dept-operations",
      key: "operations",
      name: "Operations",
      sortOrder: 0,
    },
  },
  {
    id: "module-contacts",
    key: "contacts",
    name: "Contacts",
    path: "/dept/sales/contacts",
    icon: "layout-dashboard",
    order: 1,
    actions: ["VIEW"],
    type: "DATA_TABLE",
    group: "Sales",
    department: {
      id: "dept-sales",
      key: "sales",
      name: "Sales",
      sortOrder: 1,
    },
  },
];

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  }),
  useParams: () => ({ dept: "operations", module: "project-management" }),
  usePathname: () => "/dept/operations/project-management",
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/hooks/useAccessibleModules", () => ({
  useAccessibleModules: () => ({
    modules: mockModules,
    groups: [],
    loading: false,
    error: null,
    refresh: jest.fn(),
  }),
}));

jest.mock("@/stores/auth-store", () => ({
  useAuthStore: (
    selector: (state: { user: { role: string } }) => unknown,
  ) => selector({ user: { role: "ADMIN" } }),
}));

jest.mock("@/services/search", () => ({
  SearchService: {
    search: (...args: unknown[]) => mockSearch(...args),
  },
}));

import { CommandPalette } from "@/components/command-palette/CommandPalette";

function renderPalette() {
  const onOpenChange = jest.fn();
  const result = renderWithProviders(
    <CommandPalette open onOpenChange={onOpenChange} />,
  );
  return { ...result, onOpenChange };
}

const recordResult = {
  query: "proj",
  tookMs: 8,
  groups: [
    {
      type: "record" as const,
      moduleId: "module-project-management",
      moduleKey: "project-management",
      deptKey: "operations",
      moduleName: "Project Management",
      items: [
        {
          id: "project-1",
          title: "Project Alpha",
          subtitle: "Active",
          updatedAt: "2026-11-10T10:00:00.000Z",
          href: "/dept/operations/project-management?open=project-1",
        },
      ],
    },
  ],
};

function recent(overrides: Record<string, unknown> = {}) {
  return {
    id: "recent-1",
    kind: "record" as const,
    title: "Recent record",
    subtitle: "Operations",
    href: "/dept/operations/project-management?open=recent-1",
    moduleKey: "project-management",
    deptKey: "operations",
    ...overrides,
  };
}

describe("CommandPalette", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockSearch.mockResolvedValue({ query: "", tookMs: 0, groups: [] });
  });

  it("lists accessible modules and opens workspace settings for admins", () => {
    renderPalette();

    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeVisible();
    expect(screen.getAllByText("Project Management").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Contacts").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Open workspace settings"),
    ).toBeVisible();
  });

  it("debounces after 2 characters and renders grouped server results", async () => {
    mockSearch.mockResolvedValue(recordResult);
    const user = userEvent.setup();
    renderPalette();

    await user.type(screen.getByTestId("command-palette-input"), "proj");

    expect(await screen.findByText("Project Alpha")).toBeVisible();
    await waitFor(() =>
      expect(mockSearch).toHaveBeenCalledWith(
        "proj",
        expect.objectContaining({ limit: 5 }),
      ),
    );
    expect(mockSearch).toHaveBeenCalledTimes(1);
  });

  it("navigates and stores a recent entry when a result is selected", async () => {
    mockSearch.mockResolvedValue(recordResult);
    const user = userEvent.setup();
    const { onOpenChange } = renderPalette();

    await user.type(screen.getByTestId("command-palette-input"), "proj");
    fireEvent.click(await screen.findByText("Project Alpha"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockPush).toHaveBeenCalledWith(
      "/dept/operations/project-management?open=project-1",
    );

    const stored = JSON.parse(
      window.localStorage.getItem("command_palette_recents_v1") ?? "[]",
    );
    expect(stored[0]).toEqual(
      expect.objectContaining({
        id: "project-1",
        kind: "record",
        moduleKey: "project-management",
      }),
    );
  });

  it("hides recents that point at modules the user cannot open", () => {
    saveCommandPaletteRecent(
      recent({
        id: "visible",
        title: "Visible recent",
        href: "/dept/operations/project-management?open=visible",
      }),
      window.localStorage,
    );
    saveCommandPaletteRecent(
      recent({
        id: "hidden",
        title: "Hidden recent",
        href: "/dept/sales/secret?open=hidden",
        moduleKey: "secret-module",
        deptKey: "sales",
      }),
      window.localStorage,
    );

    renderPalette();

    expect(screen.getByText("Visible recent")).toBeVisible();
    expect(screen.queryByText("Hidden recent")).not.toBeInTheDocument();
  });

  it("shows the minimum length hint and an empty state", async () => {
    const user = userEvent.setup();
    renderPalette();

    await user.type(screen.getByTestId("command-palette-input"), "z");
    expect(
      screen.getByText(/Type at least 2 characters to search/i),
    ).toBeVisible();
    expect(mockSearch).not.toHaveBeenCalled();

    await user.type(screen.getByTestId("command-palette-input"), "z");
    expect(await screen.findByText(/No matches for/)).toBeVisible();
  });

  it("offers Create record for the current module and deep-links with ?create=1", () => {
    renderPalette();

    fireEvent.click(screen.getByText("Create record"));

    expect(mockPush).toHaveBeenCalledWith(
      "/dept/operations/project-management?create=1",
    );
  });

  it("surfaces search failures with a retry action", async () => {
    mockSearch.mockRejectedValue(new Error("Search failed"));
    const user = userEvent.setup();
    renderPalette();

    await user.type(screen.getByTestId("command-palette-input"), "proj");

    expect(
      await screen.findByText(
        /Search failed. Check your connection and retry./,
        undefined,
        { timeout: 8_000 },
      ),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });
});
