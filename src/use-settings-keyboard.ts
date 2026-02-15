import { useEffect, type RefObject } from "react";
import { getNextIndex } from "./utils/keyboard";

export type UseSettingsKeyboardOptions = {
  containerRef: RefObject<HTMLElement | null>;
  itemSelector?: string;
  orientation?: "vertical" | "horizontal";
  onEscape?: () => void;
};

/**
 * Adds roving keyboard navigation across settings items inside a container.
 */
export const useSettingsKeyboard = ({
  containerRef,
  itemSelector = "[data-settings-item]",
  orientation = "vertical",
  onEscape
}: UseSettingsKeyboardOptions): void => {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const getItems = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(itemSelector)).filter(
        (el) => !el.hasAttribute("disabled")
      );

    const handleKeyDown = (event: KeyboardEvent): void => {
      const items = getItems();
      if (items.length === 0) {
        return;
      }

      const currentIndex = items.findIndex((item) => item === document.activeElement);
      const nextKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
      const prevKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";

      if (event.key === nextKey || event.key === prevKey) {
        event.preventDefault();
        const nextIndex = getNextIndex(currentIndex, items.length, event.key === nextKey ? "next" : "prev");
        const target = items[nextIndex];
        target?.focus();
      }

      if (event.key === "Home") {
        event.preventDefault();
        items[0]?.focus();
      }

      if (event.key === "End") {
        event.preventDefault();
        items[items.length - 1]?.focus();
      }

      if (event.key === "Escape") {
        onEscape?.();
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [containerRef, itemSelector, orientation, onEscape]);
};
