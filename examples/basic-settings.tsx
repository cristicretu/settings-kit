"use client";

import { useState, useRef } from "react";
import {
  SettingsProvider,
  SettingsRegistryProvider,
  useSetting,
  useSettingDirty,
  useSettingsStore,
  useSettingsSearch,
  useSettingsHistory,
  useVisibleWhen,
  getHighlightRanges,
  useSettingsRegistryItem,
} from "../src";

// --- State -------------------------------------------------------------------

type Settings = {
  theme: string;
  language: string;
  fontSize: string;
  notifications: boolean;
  autoSave: boolean;
  advanced: {
    debugMode: boolean;
    logLevel: string;
  };
};

const initialState: Settings = {
  theme: "system",
  language: "en",
  fontSize: "14",
  notifications: true,
  autoSave: true,
  advanced: {
    debugMode: false,
    logLevel: "warn",
  },
};

// --- Minimal styles ----------------------------------------------------------

const styles = {
  page: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    maxWidth: 640,
    margin: "40px auto",
    padding: "0 20px",
    color: "#1a1a1a",
    fontSize: 14,
    lineHeight: 1.5,
  } as const,
  heading: { fontSize: 20, fontWeight: 600, marginBottom: 4 } as const,
  subtitle: { color: "#666", marginBottom: 24, fontSize: 13 } as const,
  section: { marginBottom: 32 } as const,
  sectionTitle: { fontSize: 13, fontWeight: 600, marginBottom: 12, color: "#444" } as const,
  card: {
    border: "1px solid #e5e5e5",
    borderRadius: 8,
    overflow: "hidden",
  } as const,
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    borderTop: "1px solid #e5e5e5",
    gap: 12,
  } as const,
  rowFirst: { borderTop: "none" } as const,
  label: { fontSize: 13 } as const,
  desc: { fontSize: 12, color: "#888", marginTop: 1 } as const,
  select: {
    fontSize: 13,
    padding: "4px 8px",
    borderRadius: 6,
    border: "1px solid #d5d5d5",
    background: "#fff",
  } as const,
  checkbox: { width: 16, height: 16, accentColor: "#111" } as const,
  badge: {
    fontSize: 10,
    color: "#c07600",
    background: "#fff3d6",
    padding: "1px 6px",
    borderRadius: 10,
    marginLeft: 8,
    fontWeight: 500,
  } as const,
  button: {
    fontSize: 12,
    padding: "5px 12px",
    borderRadius: 6,
    border: "1px solid #d5d5d5",
    background: "#fafafa",
    cursor: "pointer",
  } as const,
  searchInput: {
    width: "100%",
    fontSize: 13,
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #e5e5e5",
    marginBottom: 12,
    outline: "none",
    boxSizing: "border-box" as const,
  } as const,
  searchResult: {
    padding: "8px 12px",
    borderTop: "1px solid #f0f0f0",
    fontSize: 13,
  } as const,
};

// --- Components --------------------------------------------------------------

function SettingRow({
  id,
  title,
  description,
  path,
  first,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  path: string;
  first?: boolean;
  children: React.ReactNode;
}) {
  const dirty = useSettingDirty(path, { baseline: "mount" });

  useSettingsRegistryItem({
    id,
    label: title,
    description,
  });

  return (
    <div style={{ ...styles.row, ...(first ? styles.rowFirst : {}) }}>
      <div>
        <div style={styles.label}>
          {title}
          {dirty && <span style={styles.badge}>modified</span>}
        </div>
        {description && <div style={styles.desc}>{description}</div>}
      </div>
      {children}
    </div>
  );
}

function GeneralSection() {
  const [theme, setTheme] = useSetting<string>("theme");
  const [language, setLanguage] = useSetting<string>("language");
  const [fontSize, setFontSize] = useSetting<string>("fontSize");
  const [notifications, setNotifications] = useSetting<boolean>("notifications");
  const [autoSave, setAutoSave] = useSetting<boolean>("autoSave");

  const { undo, redo, canUndo, canRedo } = useSettingsHistory({
    value: theme ?? "system",
    onChange: setTheme,
  });

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>General</div>
      <div style={styles.card}>
        <SettingRow id="theme" title="Theme" description="Color scheme for the interface" path="theme" first>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <select style={styles.select} value={theme ?? "system"} onChange={(e) => setTheme(e.target.value)}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
            <button style={styles.button} disabled={!canUndo} onClick={undo} title="Undo">&#8630;</button>
            <button style={styles.button} disabled={!canRedo} onClick={redo} title="Redo">&#8631;</button>
          </div>
        </SettingRow>
        <SettingRow id="language" title="Language" description="Display language" path="language">
          <select style={styles.select} value={language ?? "en"} onChange={(e) => setLanguage(e.target.value)}>
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
          </select>
        </SettingRow>
        <SettingRow id="fontSize" title="Font size" description="Editor font size in pixels" path="fontSize">
          <select style={styles.select} value={fontSize ?? "14"} onChange={(e) => setFontSize(e.target.value)}>
            <option value="12">12px</option>
            <option value="14">14px</option>
            <option value="16">16px</option>
            <option value="18">18px</option>
          </select>
        </SettingRow>
        <SettingRow id="notifications" title="Notifications" path="notifications">
          <input
            type="checkbox"
            style={styles.checkbox}
            checked={notifications ?? true}
            onChange={(e) => setNotifications(e.target.checked)}
          />
        </SettingRow>
        <SettingRow id="autoSave" title="Auto-save" description="Automatically save changes" path="autoSave">
          <input
            type="checkbox"
            style={styles.checkbox}
            checked={autoSave ?? true}
            onChange={(e) => setAutoSave(e.target.checked)}
          />
        </SettingRow>
      </div>
    </div>
  );
}

function AdvancedSection() {
  const [debugMode, setDebugMode] = useSetting<boolean>("advanced.debugMode");
  const [logLevel, setLogLevel] = useSetting<string>("advanced.logLevel");
  const showLogLevel = useVisibleWhen("advanced.debugMode", true);

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Advanced</div>
      <div style={styles.card}>
        <SettingRow id="debugMode" title="Debug mode" description="Enable debug logging" path="advanced.debugMode" first>
          <input
            type="checkbox"
            style={styles.checkbox}
            checked={debugMode ?? false}
            onChange={(e) => setDebugMode(e.target.checked)}
          />
        </SettingRow>
        {showLogLevel && (
          <SettingRow id="logLevel" title="Log level" description="Minimum log severity" path="advanced.logLevel">
            <select style={styles.select} value={logLevel ?? "warn"} onChange={(e) => setLogLevel(e.target.value)}>
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
            </select>
          </SettingRow>
        )}
      </div>
    </div>
  );
}

function SearchOverlay({ query, onQueryChange }: { query: string; onQueryChange: (q: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { results } = useSettingsSearch({ containerRef });

  return (
    <div ref={containerRef}>
      <input
        type="text"
        style={styles.searchInput}
        placeholder="Search settings…"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
      />
      {query && results.length > 0 && (
        <div style={{ ...styles.card, marginBottom: 24 }}>
          {results.map((r) => (
            <div key={r.id} style={styles.searchResult}>
              <HighlightedText text={r.label} query={query} />
              {r.description && (
                <span style={{ color: "#888" }}>
                  {" — "}
                  <HighlightedText text={r.description} query={query} />
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {query && results.length === 0 && (
        <div style={{ color: "#888", fontSize: 13, marginBottom: 24 }}>No results for &ldquo;{query}&rdquo;</div>
      )}
    </div>
  );
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const ranges = getHighlightRanges(text, query);
  if (ranges.length === 0) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const { start, end } of ranges) {
    if (start > last) parts.push(text.slice(last, start));
    parts.push(<mark key={start} style={{ background: "#ffe066", borderRadius: 2, padding: "0 1px" }}>{text.slice(start, end)}</mark>);
    last = end;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function ResetBar() {
  const store = useSettingsStore<Settings>();
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
      <button style={styles.button} onClick={() => store.reset()}>
        Reset all to defaults
      </button>
    </div>
  );
}

// --- Root --------------------------------------------------------------------

export default function BasicSettings() {
  const [query, setQuery] = useState("");

  return (
    <SettingsProvider initialState={initialState}>
      <SettingsRegistryProvider>
        <div style={styles.page}>
          <h1 style={styles.heading}>Settings</h1>
          <p style={styles.subtitle}>Powered by @settings-kit/headless</p>
          <SearchOverlay query={query} onQueryChange={setQuery} />
          <ResetBar />
          <GeneralSection />
          <AdvancedSection />
        </div>
      </SettingsRegistryProvider>
    </SettingsProvider>
  );
}
