import { createContext, useContext, useState, useEffect } from "react";
import { DEFAULT_THEME, applyTheme } from '../config/themes';

const SettingsContext = createContext(undefined);

const SETTINGS_KEY = 'appSettings';
const DEFAULT_SETTINGS = {
  replayFeaturesEnabled: false,
  selectedTheme: DEFAULT_THEME
};

function loadSettings() {
  try {
    const stored = window.localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => loadSettings());

  // Apply theme on initial load
  useEffect(() => {
    applyTheme(settings.selectedTheme || DEFAULT_THEME);
  }, []);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const updateSettings = (updates) => {
    setSettings(prev => {
      const next = { ...prev, ...updates };
      saveSettings(next);
      return next;
    });
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
