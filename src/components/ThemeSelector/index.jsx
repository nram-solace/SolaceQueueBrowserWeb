import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { Dropdown } from 'primereact/dropdown';
import { useSettings } from '../../providers/SettingsProvider';
import { getThemeList, getTheme, DEFAULT_THEME, applyTheme } from '../../config/themes';
import classes from './styles.module.css';

export default function ThemeSelector({ showLabel = true }) {
  const { settings, updateSettings } = useSettings();
  const themes = getThemeList();
  const currentTheme = getTheme(settings.selectedTheme || DEFAULT_THEME);

  // Apply theme on mount and when theme changes
  useEffect(() => {
    const themeId = settings.selectedTheme || DEFAULT_THEME;
    applyTheme(themeId);
    
    // Also apply to iframe if present
    const contentFrame = document.querySelector('iframe');
    if (contentFrame?.contentDocument) {
      applyTheme(themeId, contentFrame.contentDocument);
    }
  }, [settings.selectedTheme]);

  const handleThemeChange = (e) => {
    // e.value is the theme object, we need to save the ID
    const newThemeId = e.value?.id || e.value;
    updateSettings({ selectedTheme: newThemeId });
  };

  // Group themes by variant (Light/Dark) for the dropdown
  const groupedThemes = [
    {
      label: '☀️ Light',
      items: themes.filter(t => t.variant === 'light').sort((a, b) => a.brandDisplayName.localeCompare(b.brandDisplayName))
    },
    {
      label: '🌙 Dark',
      items: themes.filter(t => t.variant === 'dark').sort((a, b) => a.brandDisplayName.localeCompare(b.brandDisplayName))
    }
  ];

  // Template for theme options - show brand name with color swatch
  const themeOptionTemplate = (option) => {
    if (!option) return null;
    return (
      <div className={classes.themeOption}>
        <span 
          className={classes.colorSwatch} 
          style={{ backgroundColor: option.primary }}
        />
        <span className={classes.themeName}>{option.brandDisplayName}</span>
      </div>
    );
  };

  // Template for selected value
  const selectedValueTemplate = (option) => {
    if (!option) return <span>Select Theme</span>;
    return (
      <div className={classes.themeOption}>
        <span 
          className={classes.colorSwatch} 
          style={{ backgroundColor: option.primary }}
        />
        <span className={classes.themeName}>{option.brandDisplayName}</span>
        <span className={classes.themeVariant}>
          {option.variant === 'dark' ? '🌙' : '☀️'}
        </span>
      </div>
    );
  };

  // Template for group headers
  const groupTemplate = (option) => {
    return (
      <div className={classes.themeGroup}>
        <span className={classes.groupLabel}>{option.label}</span>
      </div>
    );
  };

  return (
    <div className={classes.selectorContainer}>
      {showLabel && (
        <label htmlFor="theme-selector" className={classes.label}>
          Theme
        </label>
      )}
      <Dropdown
        id="theme-selector"
        value={currentTheme}
        options={groupedThemes}
        optionLabel="name"
        optionGroupLabel="label"
        optionGroupChildren="items"
        dataKey="id"
        onChange={handleThemeChange}
        itemTemplate={themeOptionTemplate}
        valueTemplate={selectedValueTemplate}
        optionGroupTemplate={groupTemplate}
        className={classes.dropdown}
        panelClassName={classes.dropdownPanel}
        placeholder="Select Theme"
      />
    </div>
  );
}

ThemeSelector.propTypes = {
  showLabel: PropTypes.bool
};

