import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import { getHighlightRanges, searchItems, type SearchItem, type SearchResult, type TextMatchRange } from "./utils/search";
import { useSettingsRegistryItems } from "./settings-registry";

export type SettingsSearchInclude = {
  label?: boolean;
  description?: boolean;
  keywords?: boolean;
  group?: boolean;
  options?: boolean;
};

export type UseSettingsSearchOptions = {
  containerRef?: RefObject<HTMLElement | null>;
  items?: SearchItem[];
  debounceMs?: number;
  include?: SettingsSearchInclude;
};

export type UseSettingsSearchResult = {
  query: string;
  setQuery: (query: string) => void;
  results: SearchResult[];
  isSearching: boolean;
  clearSearch: () => void;
  highlightMatches: (text: string) => TextMatchRange[];
};

const itemSelector = "[data-settings-item]";
const optionsSelector = "[data-settings-options]";

type DomSearchItem = SearchItem & {
  optionKeywords?: string[];
};

const defaults: Required<SettingsSearchInclude> = {
  label: true,
  description: true,
  keywords: true,
  group: true,
  options: true
};

const parseTokens = (value: string | undefined): string[] =>
  (value ?? "")
    .split(/[|,]/)
    .map((token) => token.trim())
    .filter(Boolean);

const areItemsEqual = (left: DomSearchItem[], right: DomSearchItem[]): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => {
    const candidate = right[index];
    if (!candidate) {
      return false;
    }

    return (
      item.id === candidate.id &&
      item.label === candidate.label &&
      item.description === candidate.description &&
      item.group === candidate.group &&
      (item.keywords ?? []).join("|") === (candidate.keywords ?? []).join("|") &&
      (item.optionKeywords ?? []).join("|") === (candidate.optionKeywords ?? []).join("|")
    );
  });
};

const deriveItemsFromDom = (root: HTMLElement | null): DomSearchItem[] => {
  if (!root) {
    return [];
  }

  return Array.from(root.querySelectorAll<HTMLElement>(itemSelector)).map((el, index) => {
    const optionKeywords = Array.from(el.querySelectorAll<HTMLElement>(optionsSelector)).flatMap((node) =>
      parseTokens(node.dataset.settingsOptions)
    );

    return {
      id: el.dataset.settingsId ?? `item-${index}`,
      label: el.dataset.settingsLabel ?? el.textContent?.trim() ?? `Item ${index + 1}`,
      description: el.dataset.settingsDescription,
      keywords: parseTokens(el.dataset.settingsKeywords),
      optionKeywords,
      group: el.dataset.settingsGroup
    };
  });
};

/**
 * Debounced fuzzy search for settings UIs using explicit items or DOM extraction.
 * DOM-derived items are scanned once on mount; pass explicit items for dynamic lists.
 */
export const useSettingsSearch = ({
  containerRef,
  items,
  debounceMs = 150,
  include: includeOptions
}: UseSettingsSearchOptions): UseSettingsSearchResult => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [domItems, setDomItems] = useState<DomSearchItem[]>([]);
  const registryItems = useSettingsRegistryItems({ optional: true });
  const hasRegistryItems = registryItems.length > 0;
  const include = { ...defaults, ...includeOptions };

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedQuery(query), debounceMs);
    return () => window.clearTimeout(handle);
  }, [query, debounceMs]);

  useEffect(() => {
    if (items) {
      return;
    }

    const root = containerRef?.current;
    if (!root) {
      return;
    }
    if (hasRegistryItems) {
      return;
    }

    let frame = 0;
    const sync = () => {
      const next = deriveItemsFromDom(root);
      setDomItems((previous) => (areItemsEqual(previous, next) ? previous : next));
    };

    sync();

    const observer = new MutationObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(sync);
    });

    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        "data-settings-item",
        "data-settings-id",
        "data-settings-label",
        "data-settings-description",
        "data-settings-keywords",
        "data-settings-group",
        "data-settings-options"
      ]
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [containerRef, hasRegistryItems, items]);

  const registrySearchItems = useMemo<DomSearchItem[]>(
    () =>
      registryItems.map((item) => ({
        id: item.id,
        label: item.label,
        description: item.description,
        group: item.group,
        keywords: item.keywords ?? [],
        optionKeywords: item.options ?? []
      })),
    [registryItems]
  );

  const sourceItems = useMemo<DomSearchItem[]>(
    () =>
      items
        ? items.map((item) => ({ ...item, optionKeywords: [] }))
        : hasRegistryItems
          ? registrySearchItems
          : domItems,
    [domItems, hasRegistryItems, items, registrySearchItems]
  );

  const indexedItems = useMemo<SearchItem[]>(
    () =>
      sourceItems
        .map((item) => {
          const mergedKeywords = [
            ...(include.keywords ? item.keywords ?? [] : []),
            ...(include.options ? item.optionKeywords ?? [] : [])
          ];

          return {
            ...item,
            label: include.label ? item.label : "",
            description: include.description ? item.description : undefined,
            group: include.group ? item.group : undefined,
            keywords: mergedKeywords
          };
        })
        .filter(
          (item) =>
            item.label.trim().length > 0 ||
            (item.description?.trim().length ?? 0) > 0 ||
            (item.group?.trim().length ?? 0) > 0 ||
            (item.keywords?.length ?? 0) > 0
        ),
    [sourceItems, include.description, include.group, include.keywords, include.label, include.options]
  );

  const results = useMemo(() => searchItems(indexedItems, debouncedQuery), [indexedItems, debouncedQuery]);

  const clearSearch = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
  }, []);

  const highlightMatches = useCallback(
    (text: string) => getHighlightRanges(text, debouncedQuery),
    [debouncedQuery]
  );

  return {
    query,
    setQuery,
    results,
    isSearching: debouncedQuery.length > 0,
    clearSearch,
    highlightMatches
  };
};
