"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  secondary?: string | null;
}

interface ComboboxProps {
  id?: string;
  value: string;
  /** Label for the selected value while the list is closed. */
  selectedLabel?: string;
  options: ComboboxOption[];
  onChange: (option: ComboboxOption | null) => void;
  onSearch?: (query: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  loading?: boolean;
  disabled?: boolean;
  allowClear?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/**
 * Accessible searchable single-select.
 *
 * The listbox is portalled to `document.body` with fixed positioning so it is
 * not clipped by the scrollable form grid or drawer sections.
 */
export function Combobox({
  id,
  value,
  selectedLabel,
  options,
  onChange,
  onSearch,
  placeholder = "Search…",
  emptyMessage = "No matches",
  loading = false,
  disabled = false,
  allowClear = true,
  className,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: ComboboxProps) {
  const generatedId = useId();
  const inputId = id ?? `combobox-${generatedId}`;
  const listId = `${inputId}-listbox`;

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [rect, setRect] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const selected = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );
  const display = open
    ? query
    : (selected?.label ?? selectedLabel ?? "");

  const measure = useCallback(() => {
    const node = inputRef.current;
    if (!node) return;
    const bounds = node.getBoundingClientRect();
    setRect({
      left: bounds.left,
      top: bounds.bottom + 4,
      width: bounds.width,
    });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  useEffect(() => {
    if (!open) return;
    measure();

    const reposition = () => measure();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (inputRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      close();
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open, measure, close]);

  useEffect(() => {
    if (activeIndex > options.length - 1) {
      setActiveIndex(Math.max(0, options.length - 1));
    }
  }, [options.length, activeIndex]);

  const select = (option: ComboboxOption) => {
    onChange(option);
    close();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setQuery("");
        setActiveIndex(0);
        return;
      }
      setActiveIndex((index) =>
        options.length === 0 ? 0 : (index + 1) % options.length,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return;
      setActiveIndex((index) =>
        options.length === 0
          ? 0
          : (index - 1 + options.length) % options.length,
      );
      return;
    }

    if (event.key === "Enter") {
      if (!open) return;
      event.preventDefault();
      const option = options[activeIndex];
      if (option) select(option);
      return;
    }

    if (event.key === "Escape") {
      if (!open) return;
      event.preventDefault();
      close();
      return;
    }

    if (event.key === "Tab") {
      close();
    }
  };

  const listbox =
    mounted && open && rect
      ? createPortal(
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Options"
            style={{
              position: "fixed",
              left: rect.left,
              top: rect.top,
              width: rect.width,
              zIndex: 60,
            }}
            className="max-h-64 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          >
            {loading ? (
              <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Searching…
              </div>
            ) : options.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                {emptyMessage}
              </p>
            ) : (
              options.map((option, index) => {
                const isSelected = option.value === value;
                const isActive = index === activeIndex;
                return (
                  <button
                    key={option.value}
                    id={`${listId}-${index}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm",
                      isActive && "bg-accent text-accent-foreground",
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => select(option)}
                  >
                    <Check
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{option.label}</span>
                      {option.secondary ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {option.secondary}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && options[activeIndex]
              ? `${listId}-${activeIndex}`
              : undefined
          }
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          autoComplete="off"
          value={display}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-sm transition-colors",
            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            ariaInvalid && "border-destructive",
          )}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setOpen(true);
            setActiveIndex(0);
            onSearch?.(next);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
            setActiveIndex(0);
            measure();
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // The list closes on outside mousedown; blur alone is too eager
            // inside dialogs.
          }}
        />

        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
          {loading ? (
            <Loader2
              className="h-4 w-4 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          ) : (
            <ChevronsUpDown
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
          )}
        </div>

        {allowClear && value && !disabled ? (
          <button
            type="button"
            aria-label="Clear selection"
            className="absolute inset-y-0 right-7 flex items-center text-muted-foreground hover:text-foreground"
            onClick={() => {
              onChange(null);
              setQuery("");
              close();
            }}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {listbox}
    </div>
  );
}
