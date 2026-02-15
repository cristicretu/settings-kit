/** Settings search index entry. */
export type SearchItem = {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
  group?: string;
};

/** Search result with score and highlighted fields. */
export type SearchResult = SearchItem & {
  score: number;
  matches: string[];
};

export type TextMatchRange = {
  start: number;
  end: number;
};

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const scoreField = (field: string, query: string): number => {
  const nField = normalize(field);
  const nQuery = normalize(query);

  if (!nField || !nQuery) {
    return 0;
  }

  if (nField === nQuery) {
    return 100;
  }

  if (nField.startsWith(nQuery)) {
    return 75;
  }

  if (nField.includes(nQuery)) {
    return 50;
  }

  const queryTokens = nQuery.split(/\s+/);
  const matched = queryTokens.filter((token) => nField.includes(token)).length;

  return matched > 0 ? Math.round((matched / queryTokens.length) * 40) : 0;
};

const tokenize = (value: string): string[] =>
  normalize(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

const tokenCoverage = (fields: string[], tokens: string[]): number => {
  if (tokens.length === 0) {
    return 0;
  }

  const haystack = normalize(fields.join(" "));
  return tokens.filter((token) => haystack.includes(token)).length;
};

/**
 * Searches settings items with lightweight fuzzy scoring.
 */
export const searchItems = (items: SearchItem[], query: string): SearchResult[] => {
  if (!query.trim()) {
    return items.map((item) => ({
      ...item,
      score: 0,
      matches: []
    }));
  }

  const normalizedQuery = normalize(query);
  const queryTokens = tokenize(query);

  return items
    .map((item) => {
      const primaryFields = [item.label, item.description ?? "", item.group ?? ""];
      const fields = [...primaryFields, ...(item.keywords ?? [])];

      const scores = fields.map((field) => scoreField(field, query));
      const labelScore = scoreField(item.label, query);
      const primaryCoverage = tokenCoverage(primaryFields, queryTokens);
      const totalCoverage = tokenCoverage(fields, queryTokens);
      const hasExactPrimary = primaryFields.some((field) => normalize(field).includes(normalizedQuery));

      if (queryTokens.length > 1 && !hasExactPrimary && totalCoverage < queryTokens.length) {
        return {
          ...item,
          score: 0,
          matches: []
        };
      }

      const score =
        Math.max(...scores) +
        (primaryCoverage > 0 ? primaryCoverage * 6 : 0) +
        (labelScore > 0 ? 8 : 0) +
        (totalCoverage === queryTokens.length && queryTokens.length > 1 ? 12 : 0);

      return {
        ...item,
        score,
        matches: fields.filter((field, index) => scores[index] > 0)
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
};

/**
 * Returns matched ranges for UI highlighting.
 */
export const getHighlightRanges = (text: string, query: string): TextMatchRange[] => {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const ranges: TextMatchRange[] = [];
  let match: RegExpExecArray | null = regex.exec(text);

  while (match) {
    ranges.push({
      start: match.index,
      end: match.index + match[0].length
    });
    match = regex.exec(text);
  }

  return ranges;
};
