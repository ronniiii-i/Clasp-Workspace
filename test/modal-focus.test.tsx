import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Modal } from "@/components/ui/modal";

describe("Modal focus management", () => {
  it("focuses the first control, traps Tab, and restores focus on close", () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open dialog
          </button>
          <Modal
            open={open}
            onClose={() => setOpen(false)}
            title="Example dialog"
            footer={<button type="button">Save</button>}
          >
            <input aria-label="Name" />
          </Modal>
        </>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Example dialog" });
    const close = screen.getByRole("button", { name: "Close" });
    const input = screen.getByLabelText("Name");
    const save = screen.getByRole("button", { name: "Save" });

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(document.activeElement).toBe(close);

    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(input);

    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(save);

    // Tab from the last control wraps back to the first one.
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(close);

    // Shift+Tab from the first control wraps to the last one.
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(save);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it("lets a nested dialog own Escape without closing its parent", () => {
    function Harness() {
      const [outer, setOuter] = useState(true);
      const [inner, setInner] = useState(false);
      return (
        <>
          <Modal open={outer} onClose={() => setOuter(false)} title="Outer">
            <button type="button" onClick={() => setInner(true)}>
              Open nested
            </button>
          </Modal>
          <Modal open={inner} onClose={() => setInner(false)} title="Nested" />
        </>
      );
    }

    render(<Harness />);
    expect(screen.getByRole("dialog", { name: "Outer" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open nested" }));
    expect(screen.getByRole("dialog", { name: "Nested" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Nested" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Outer" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Outer" })).not.toBeInTheDocument();
  });
});
