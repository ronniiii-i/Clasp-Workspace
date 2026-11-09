import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AvatarUploader } from "@/components/profile/AvatarUploader";

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockToast = jest.requireMock("sonner").toast as {
  success: jest.Mock;
  error: jest.Mock;
};

jest.mock("@/stores/auth-store", () => {
  const state = {
    token: "test-token",
    refreshUserData: jest.fn(async () => undefined),
  };
  const useAuthStore = (selector: (value: typeof state) => unknown) =>
    selector(state);
  useAuthStore.getState = () => state;
  return { useAuthStore };
});

describe("AvatarUploader", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("shows initials when there is no avatar", () => {
    render(<AvatarUploader avatarUrl={null} name="Ada Okafor" />);
    expect(screen.getByText("AO")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Upload profile picture" }),
    ).toBeInTheDocument();
  });

  it("shows the current avatar and offers replace/remove", () => {
    render(
      <AvatarUploader
        avatarUrl="https://cdn.example.com/avatar.png"
        name="Ada Okafor"
      />,
    );

    expect(
      screen.getByRole("img", { name: "Ada Okafor's profile picture" }),
    ).toHaveAttribute("src", "https://cdn.example.com/avatar.png");
    expect(
      screen.getByRole("button", { name: "Upload profile picture" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /remove image/i }),
    ).toBeInTheDocument();
  });

  it("rejects a non-image file before uploading", async () => {
    render(<AvatarUploader avatarUrl={null} name="Ada Okafor" />);

    const input = screen.getByTestId("avatar-file-input");
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(
        screen.getByText("Choose a PNG, JPEG or WebP image"),
      ).toBeInTheDocument(),
    );
    expect(mockToast.error).toHaveBeenCalledWith(
      "Choose a PNG, JPEG or WebP image",
    );
  });

  it("removes the avatar and clears the parent value", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, avatarUrl: null }),
    }) as unknown as typeof fetch;
    const onChange = jest.fn();

    render(
      <AvatarUploader
        avatarUrl="https://cdn.example.com/avatar.png"
        name="Ada Okafor"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /remove image/i }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/profile/avatar"),
      expect.objectContaining({ method: "DELETE" }),
    );
    await waitFor(() => expect(mockToast.success).toHaveBeenCalled());
  });

  it("restores the previous avatar when removal fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Nope" }),
    }) as unknown as typeof fetch;
    const onChange = jest.fn();

    render(
      <AvatarUploader
        avatarUrl="https://cdn.example.com/avatar.png"
        name="Ada Okafor"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /remove image/i }));

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(
        "https://cdn.example.com/avatar.png",
      ),
    );
  });
});
