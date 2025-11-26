import { writable } from "svelte/store";
import { api } from "$lib/api";

export interface ThemeSettings {
  "display-feedback-publicly": boolean;
  "enable-translations": boolean;
  "displayed-statuses-statuses"?: string[];
  [key: string]: any;
}

const defaultThemeSettings: ThemeSettings = {
  "display-feedback-publicly": true,
  "enable-translations": true,
};

function createThemeSettingsStore() {
  const { subscribe, set, update } = writable<ThemeSettings>(defaultThemeSettings);

  let loaded = false;

  return {
    subscribe,
    load: async () => {
      if (loaded) return;

      try {
        const settingsData = await api.getThemeSettings();

        if (settingsData.settings && typeof settingsData.settings === "object") {
          const newSettings: ThemeSettings = {
            ...defaultThemeSettings,
            ...settingsData.settings,
          };
          set(newSettings);
        }
        loaded = true;
      } catch (err) {
        console.error("Error loading theme settings:", err);
        // Keep default values on error
      }
    },
    reset: () => {
      loaded = false;
      set(defaultThemeSettings);
    },
    get: (key: keyof ThemeSettings) => {
      let value: any;
      subscribe((settings) => {
        value = settings[key];
      })();
      return value;
    },
  };
}

export const themeSettings = createThemeSettingsStore();
