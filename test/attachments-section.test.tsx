import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "./utils/renderers";

const mockUseAttachments = jest.fn();
const mockUseAttachmentMutations = jest.fn();
const mockUpload = jest.fn();
const mockRemove = jest.fn();

jest.mock("@/hooks/workspace/useAttachments", () => ({
  useAttachments: (...args: unknown[]) => mockUseAttachments(...args),
  useAttachmentMutations: (...args: unknown[]) =>
    mockUseAttachmentMutations(...args),
}));

jest.mock("@/stores/auth-store", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ user: { id: "user-1", role: { slug: "staff" } } }),
}));

// Import after the mocks are registered.
import { AttachmentsSection } from "@/components/renderers/shared/AttachmentsSection";

const attachments = [
  {
    id: "attachment-1",
    fileName: "contract.pdf",
    mimeType: "application/pdf",
    size: 2048,
    uploadedById: "user-1",
    downloadUrl: "http://localhost/storage/local?key=one",
    createdAt: "2026-10-01T10:00:00.000Z",
    uploader: { id: "user-1", name: "Ada", email: "ada@acme.test" },
  },
  {
    id: "attachment-2",
    fileName: "deck.pptx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    size: 4096,
    uploadedById: "user-2",
    downloadUrl: "http://localhost/storage/local?key=two",
    createdAt: "2026-10-02T10:00:00.000Z",
    uploader: { id: "user-2", name: "Sam", email: "sam@acme.test" },
  },
];

function renderSection(canEdit = true) {
  return renderWithProviders(
    <AttachmentsSection
      deptKey="sales"
      moduleKey="deals"
      recordId="record-1"
      canEdit={canEdit}
    />,
  );
}

describe("AttachmentsSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAttachments.mockReturnValue({
      data: attachments,
      isPending: false,
      isError: false,
    });
    mockUseAttachmentMutations.mockReturnValue({
      upload: { mutateAsync: mockUpload, isPending: false },
      remove: { mutateAsync: mockRemove, isPending: false },
    });
    mockUpload.mockResolvedValue(undefined);
    mockRemove.mockResolvedValue(undefined);
  });

  it("lists files with size and uploader", () => {
    renderSection();

    expect(screen.getByText("contract.pdf")).toBeInTheDocument();
    expect(screen.getByText(/2.0 KB/)).toBeInTheDocument();
    expect(screen.getByText(/Ada/)).toBeInTheDocument();
    expect(mockUseAttachments).toHaveBeenCalledWith(
      "sales",
      "deals",
      "record-1",
    );
  });

  it("only offers remove for the uploader", () => {
    renderSection();

    expect(
      screen.getByRole("button", { name: "Remove contract.pdf" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove deck.pptx" }),
    ).not.toBeInTheDocument();
  });

  it("removes an attachment after confirmation", async () => {
    renderSection();

    fireEvent.click(
      screen.getByRole("button", { name: "Remove contract.pdf" }),
    );

    expect(mockRemove).toHaveBeenCalledWith("attachment-1");
  });

  it("hides the upload control in read-only mode", () => {
    renderSection(false);

    expect(
      screen.queryByRole("button", { name: /Upload/ }),
    ).not.toBeInTheDocument();
  });

  it("renders an empty state", () => {
    mockUseAttachments.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
    });

    renderSection();

    expect(screen.getByText("No attachments yet.")).toBeInTheDocument();
  });
});
