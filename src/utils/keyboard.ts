/** Keyboard navigation direction. */
export type KeyboardDirection = "next" | "prev";

/**
 * Returns the next focus index in a roving-focus list.
 */
export const getNextIndex = (
  currentIndex: number,
  total: number,
  direction: KeyboardDirection
): number => {
  if (total <= 0) {
    return -1;
  }

  if (currentIndex < 0 || currentIndex >= total) {
    return 0;
  }

  if (direction === "next") {
    return (currentIndex + 1) % total;
  }

  return (currentIndex - 1 + total) % total;
};
