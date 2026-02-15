# @settings-kit/headless

Headless, unstyled React primitives for building settings UIs. Zero dependencies beyond React 19+.

Bring your own styles — or use the [pre-built components](https://settings-kit.dev) for production-ready settings pages.

## Install

```bash
npm install @settings-kit/headless
```

## Quick Start

```tsx
import { SettingsProvider, useSetting, useSettingsStore } from "@settings-kit/headless";

const initialState = {
  theme: "system",
  notifications: true,
};

function ThemeSelect() {
  const [theme, setTheme] = useSetting("theme");
  return (
    <select value={theme} onChange={(e) => setTheme(e.target.value)}>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
      <option value="system">System</option>
    </select>
  );
}

function App() {
  return (
    <SettingsProvider initialState={initialState}>
      <ThemeSelect />
    </SettingsProvider>
  );
}
```

## Features

### Store & Provider

`createSettingsStore` + `SettingsProvider` — reactive settings store with deep path access, reset, and persistence adapters.

```tsx
import { createSettingsStore, SettingsProvider, useSetting, useSettingsStore } from "@settings-kit/headless";

// Optional: create store externally for access outside React
const store = createSettingsStore({ initialState });

// Read/write any path
const [value, setValue] = useSetting("nested.deep.path");

// Access store for reset, export, import, sync
const store = useSettingsStore();
store.reset();
```

### Dirty Tracking

```tsx
import { useSettingDirty } from "@settings-kit/headless";

const isDirty = useSettingDirty("theme", { baseline: "mount" });
// true when value differs from what it was at mount time
```

### Conditional Visibility

```tsx
import { useVisibleWhen, visibleWhen } from "@settings-kit/headless";

// Hook — subscribes to store changes
const showAdvanced = useVisibleWhen("debugMode", true);

// Pure function — use outside React or in computed logic
const visible = visibleWhen(state, "debugMode", true);
```

### Search

```tsx
import { SettingsRegistryProvider, useSettingsSearch, useSettingsRegistryItem, getHighlightRanges, searchItems } from "@settings-kit/headless";

// Wrap with registry provider for React-level search indexing
<SettingsRegistryProvider>
  <YourSettings />
</SettingsRegistryProvider>

// Register items from components
useSettingsRegistryItem({ id: "theme", label: "Theme", description: "Color scheme" });

// Search hook
const { query, setQuery, results } = useSettingsSearch({ containerRef });

// Highlight matched text
const ranges = getHighlightRanges("Dark theme", "dark");
// → [{ start: 0, end: 4 }]

// Search without hooks
const results = searchItems(items, "theme");
```

### Undo / Redo

```tsx
import { useSettingsHistory } from "@settings-kit/headless";

const { undo, redo, canUndo, canRedo } = useSettingsHistory({
  value: theme,
  onChange: setTheme,
});
```

### Deep Linking

```tsx
import { useSettingsDeepLink } from "@settings-kit/headless";

const { currentPath, setPath, createLink } = useSettingsDeepLink({
  param: "settings",
  onNavigate: (path) => setActiveTab(path),
});
```

### Keyboard Navigation

```tsx
import { useSettingsKeyboard } from "@settings-kit/headless";

useSettingsKeyboard({
  containerRef,
  orientation: "vertical",
  onEscape: () => close(),
});
// Arrow keys move focus between [data-settings-item] elements
```

### Field Accessibility

```tsx
import { useSettingsField } from "@settings-kit/headless";

const { titleId, descriptionId, controlProps } = useSettingsField();
// controlProps = { "aria-labelledby": "...", "aria-describedby": "..." }
```

### Import / Export

```tsx
const store = useSettingsStore();

// Export
const json = store.exportSettings();

// Import with strategy
const result = store.importSettings(json, { strategy: "merge" });
// result = { applied: true, strategy: "merge", conflicts: [] }
```

### Sync

```tsx
const unsub = await store.syncSettings({
  pull: () => fetch("/api/settings").then((r) => r.json()),
  push: (state) => fetch("/api/settings", { method: "POST", body: JSON.stringify(state) }),
  subscribe: (onRemoteChange) => {
    const ws = new WebSocket("/ws");
    ws.onmessage = (e) => onRemoteChange(JSON.parse(e.data));
    return () => ws.close();
  },
});
```

### Persistence

```tsx
import { createMemorySettingsPersistence, createLocalStorageSettingsPersistence } from "@settings-kit/headless";

// In-memory (testing)
const persistence = createMemorySettingsPersistence();

// localStorage
const persistence = createLocalStorageSettingsPersistence("my-app-settings");

<SettingsProvider initialState={initialState} persistence={persistence}>
```

## Example

See [`examples/basic-settings.tsx`](./examples/basic-settings.tsx) for a working demo using every feature with minimal inline styles.

## Pre-built Components

Want polished, production-ready settings UIs? Check out [settings-kit.dev](https://settings-kit.dev) for styled components that work on top of this headless library.

## License

MIT
