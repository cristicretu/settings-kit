import { describe, expect, it, vi } from "vitest";
import { createMemorySettingsPersistence, createSettingsStore } from "../src/settings-store";

type DemoState = {
  appearance: {
    theme: "light" | "dark";
  };
  notifications: {
    enabled: boolean;
  };
};

describe("createSettingsStore", () => {
  it("reads and writes nested path values", () => {
    const store = createSettingsStore<DemoState>({
      initialState: {
        appearance: { theme: "dark" },
        notifications: { enabled: true }
      }
    });

    expect(store.get("appearance.theme")).toBe("dark");

    store.set("appearance.theme", "light");

    expect(store.get("appearance.theme")).toBe("light");
  });

  it("triggers onChange with path metadata", () => {
    const onChange = vi.fn();
    const store = createSettingsStore<DemoState>({
      initialState: {
        appearance: { theme: "dark" },
        notifications: { enabled: true }
      },
      onChange
    });

    store.set("notifications.enabled", false);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toMatchObject({
      path: "notifications.enabled",
      value: false,
      previousValue: true
    });
  });

  it("hydrates from persistence", async () => {
    const persistence = createMemorySettingsPersistence<DemoState>({
      appearance: { theme: "light" },
      notifications: { enabled: false }
    });

    const store = createSettingsStore<DemoState>({
      initialState: {
        appearance: { theme: "dark" },
        notifications: { enabled: true }
      },
      persistence
    });

    await store.hydrate();

    expect(store.get("appearance.theme")).toBe("light");
    expect(store.get("notifications.enabled")).toBe(false);
  });

  it("loads persisted state synchronously when available", () => {
    const persistence = createMemorySettingsPersistence<DemoState>({
      appearance: { theme: "light" },
      notifications: { enabled: false }
    });

    const store = createSettingsStore<DemoState>({
      initialState: {
        appearance: { theme: "dark" },
        notifications: { enabled: true }
      },
      persistence
    });

    expect(store.get("appearance.theme")).toBe("light");
    expect(store.get("notifications.enabled")).toBe(false);
  });

  it("emits state change metadata", () => {
    const onStateChange = vi.fn();
    const store = createSettingsStore<DemoState>({
      initialState: {
        appearance: { theme: "dark" },
        notifications: { enabled: true }
      },
      onStateChange
    });

    store.set("appearance.theme", "light");

    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange.mock.calls[0]?.[0]).toMatchObject({
      source: "set",
      path: "appearance.theme",
      value: "light",
      previousValue: "dark"
    });
  });

  it("dispatches custom actions for external architecture", async () => {
    const store = createSettingsStore<DemoState>({
      initialState: {
        appearance: { theme: "dark" },
        notifications: { enabled: true }
      },
      actions: {
        toggleNotifications: (_payload, context) => {
          const current = context.get<boolean>("notifications.enabled") ?? false;
          context.set("notifications.enabled", !current);
        }
      }
    });

    await store.dispatch("toggleNotifications");

    expect(store.get("notifications.enabled")).toBe(false);
  });

  it("keeps initial state snapshot stable after mutations", () => {
    const initial: DemoState = {
      appearance: { theme: "dark" },
      notifications: { enabled: true }
    };
    const store = createSettingsStore<DemoState>({
      initialState: initial
    });

    store.set("appearance.theme", "light");

    expect(store.getInitialState()).toEqual({
      appearance: { theme: "dark" },
      notifications: { enabled: true }
    });
  });

  it("exports and imports settings with merge strategies", () => {
    const store = createSettingsStore<DemoState>({
      initialState: {
        appearance: { theme: "dark" },
        notifications: { enabled: true }
      }
    });

    const blob = store.exportSettings();
    expect(JSON.parse(blob)).toEqual({
      appearance: { theme: "dark" },
      notifications: { enabled: true }
    });

    store.importSettings({
      appearance: { theme: "light" }
    }, { strategy: "merge" });
    expect(store.get("appearance.theme")).toBe("light");
    expect(store.get("notifications.enabled")).toBe(true);

    const conflict = store.importSettings({
      notifications: { enabled: false }
    }, { strategy: "skip-conflicts" });
    expect(conflict.conflicts).toContain("notifications.enabled");
    expect(store.get("notifications.enabled")).toBe(true);

    // skip-conflicts does not report phantom conflicts for identical values
    const noConflict = store.importSettings({
      notifications: { enabled: true }
    }, { strategy: "skip-conflicts" });
    expect(noConflict.conflicts).toHaveLength(0);
  });

  it("replace strategy replaces entire state", () => {
    const store = createSettingsStore<DemoState>({
      initialState: {
        appearance: { theme: "dark" },
        notifications: { enabled: true }
      }
    });

    const result = store.importSettings({
      appearance: { theme: "light" },
      notifications: { enabled: false }
    } as DemoState, { strategy: "replace" });

    expect(result.applied).toBe(true);
    expect(result.strategy).toBe("replace");
    expect(store.get("appearance.theme")).toBe("light");
    expect(store.get("notifications.enabled")).toBe(false);
  });

  it("syncs settings using custom adapters", async () => {
    const pushed: DemoState[] = [];
    let remote: DemoState = {
      appearance: { theme: "light" },
      notifications: { enabled: false }
    };
    let remoteListener: ((state: DemoState) => void) | undefined;

    const store = createSettingsStore<DemoState>({
      initialState: {
        appearance: { theme: "dark" },
        notifications: { enabled: true }
      }
    });

    const stopSync = await store.syncSettings({
      pull: async () => remote,
      push: async (state) => {
        pushed.push(state);
      },
      subscribe: (listener) => {
        remoteListener = listener;
        return () => {
          remoteListener = undefined;
        };
      }
    });

    expect(store.get("appearance.theme")).toBe("light");
    expect(store.get("notifications.enabled")).toBe(false);

    store.set("appearance.theme", "dark");
    expect(pushed.at(-1)?.appearance.theme).toBe("dark");

    remote = {
      appearance: { theme: "light" },
      notifications: { enabled: true }
    };
    remoteListener?.(remote);
    expect(store.get("notifications.enabled")).toBe(true);

    stopSync();
  });

  it("routes sync push errors to onError callback", async () => {
    const errors: unknown[] = [];

    const store = createSettingsStore<DemoState>({
      initialState: {
        appearance: { theme: "dark" },
        notifications: { enabled: true }
      }
    });

    await store.syncSettings({
      push: async () => {
        throw new Error("network failure");
      },
      onError: (error) => {
        errors.push(error);
      }
    });

    store.set("appearance.theme", "light");

    // Allow the microtask (Promise rejection) to settle
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toBe("network failure");
  });
});
