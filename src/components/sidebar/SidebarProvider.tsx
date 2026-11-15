"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { usePathname } from "next/navigation";

interface SidebarContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  close: () => void;
  /** The mobile hamburger, so focus can return to it when the drawer closes. */
  triggerRef: RefObject<HTMLButtonElement | null>;
}

const SidebarContext = createContext<SidebarContextValue>({
  open: false,
  setOpen: () => undefined,
  toggle: () => undefined,
  close: () => undefined,
  triggerRef: { current: null },
});

export function useSidebar(): SidebarContextValue {
  return useContext(SidebarContext);
}

/**
 * Owns the mobile navigation drawer state.
 *
 * The drawer closes on route change and `Escape`, locks body scroll while
 * open, and returns focus to the hamburger button when it closes.
 */
export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((value) => !value), []);

  // Navigation always dismisses the drawer.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      if (wasOpen.current) {
        wasOpen.current = false;
        const trigger = triggerRef.current;
        if (trigger && document.contains(trigger)) trigger.focus();
      }
      return;
    }

    wasOpen.current = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <SidebarContext.Provider value={{ open, setOpen, toggle, close, triggerRef }}>
      {children}
    </SidebarContext.Provider>
  );
}
