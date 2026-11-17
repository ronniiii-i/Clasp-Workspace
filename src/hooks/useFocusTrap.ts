"use client";

import * as React from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(", ");

/**
 * Dialogs register in mount order so that a nested dialog (for example the
 * reassign form opened from a record drawer) is the only one that traps Tab
 * and responds to Escape. The most recently opened dialog wins.
 */
const dialogStack: HTMLElement[] = [];

export function isTopDialog(element: HTMLElement | null): boolean {
  return !!element && dialogStack[dialogStack.length - 1] === element;
}

function focusableWithin(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => element.getAttribute("aria-hidden") !== "true");
}

/**
 * Traps Tab inside `container` while `active` is true and restores focus to
 * the element that was focused before activation when it turns false.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const containerRef = React.useRef<T | null>(null);

  React.useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    dialogStack.push(container);

    const focusFirst = () => {
      const focusable = focusableWithin(container);
      (focusable[0] ?? container).focus();
    };
    focusFirst();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !isTopDialog(container)) return;

      const focusable = focusableWithin(container);
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const current = document.activeElement;
      const currentIndex = focusable.indexOf(current as HTMLElement);
      const direction = event.shiftKey ? -1 : 1;
      const nextIndex =
        currentIndex === -1
          ? direction > 0
            ? 0
            : focusable.length - 1
          : (currentIndex + direction + focusable.length) % focusable.length;

      event.preventDefault();
      focusable[nextIndex].focus();
    };

    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      const index = dialogStack.indexOf(container);
      if (index >= 0) dialogStack.splice(index, 1);
      if (
        previouslyFocused?.isConnected &&
        !dialogStack.some((open) => open.contains(previouslyFocused))
      ) {
        previouslyFocused.focus();
      }
    };
  }, [active]);

  return containerRef;
}
