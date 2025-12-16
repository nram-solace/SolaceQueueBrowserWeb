// Theme Configuration Registry
// Generic theme names based on primary colors (not brand names)
// Set enabled: true to show theme in UI, enabled: false to hide (but keep functional)

export const THEME_CONFIG = {
  'teal-light': {
    id: 'teal-light',
    name: 'Teal Light',
    variant: 'light',
    brand: 'teal',
    brandDisplayName: 'Teal',
    logo: './themes/teal/logo.svg',
    logoLight: './themes/teal/logo-light.svg', // For dark backgrounds
    logoDark: './themes/teal/logo-dark.svg',   // For light backgrounds
    cssPath: './themes/teal-light/theme.css',
    primary: '#00C895',
    isDefault: true,
    enabled: true
  },
  'teal-dark': {
    id: 'teal-dark',
    name: 'Teal Dark',
    variant: 'dark',
    brand: 'teal',
    brandDisplayName: 'Teal',
    logo: './themes/teal/logo.svg',
    logoLight: './themes/teal/logo-light.svg',
    logoDark: './themes/teal/logo-dark.svg',
    cssPath: './themes/teal-dark/theme.css',
    primary: '#00C895',
    enabled: true
  },
  'lime-light': {
    id: 'lime-light',
    name: 'Lime Light',
    variant: 'light',
    brand: 'lime',
    brandDisplayName: 'Lime',
    logo: './themes/lime/logo.svg',
    logoLight: './themes/lime/logo-light.svg',
    logoDark: './themes/lime/logo-dark.svg',
    cssPath: './themes/lime-light/theme.css',
    primary: '#76B900',
    enabled: true
  },
  'lime-dark': {
    id: 'lime-dark',
    name: 'Lime Dark',
    variant: 'dark',
    brand: 'lime',
    brandDisplayName: 'Lime',
    logo: './themes/lime/logo.svg',
    logoLight: './themes/lime/logo-light.svg',
    logoDark: './themes/lime/logo-dark.svg',
    cssPath: './themes/lime-dark/theme.css',
    primary: '#76B900',
    enabled: true
  },
  // Ruby theme (Red) - for Staples, Halliburton style
  'ruby-light': {
    id: 'ruby-light',
    name: 'Ruby Light',
    variant: 'light',
    brand: 'ruby',
    brandDisplayName: 'Ruby',
    logo: './themes/ruby/logo.svg',
    logoLight: './themes/ruby/logo-light.svg',
    logoDark: './themes/ruby/logo-dark.svg',
    cssPath: './themes/ruby-light/theme.css',
    primary: '#CC0000',
    enabled: false  // Disabled - set to true to enable
  },
  'ruby-dark': {
    id: 'ruby-dark',
    name: 'Ruby Dark',
    variant: 'dark',
    brand: 'ruby',
    brandDisplayName: 'Ruby',
    logo: './themes/ruby/logo.svg',
    logoLight: './themes/ruby/logo-light.svg',
    logoDark: './themes/ruby/logo-dark.svg',
    cssPath: './themes/ruby-dark/theme.css',
    primary: '#CC0000',
    enabled: false  // Disabled - set to true to enable
  },
  // Violet theme (Purple) - for Northern Trust style
  'violet-light': {
    id: 'violet-light',
    name: 'Violet Light',
    variant: 'light',
    brand: 'violet',
    brandDisplayName: 'Violet',
    logo: './themes/violet/logo.svg',
    logoLight: './themes/violet/logo-light.svg',
    logoDark: './themes/violet/logo-dark.svg',
    cssPath: './themes/violet-light/theme.css',
    primary: '#5C2D91',
    enabled: false  // Disabled - set to true to enable
  },
  'violet-dark': {
    id: 'violet-dark',
    name: 'Violet Dark',
    variant: 'dark',
    brand: 'violet',
    brandDisplayName: 'Violet',
    logo: './themes/violet/logo.svg',
    logoLight: './themes/violet/logo-light.svg',
    logoDark: './themes/violet/logo-dark.svg',
    cssPath: './themes/violet-dark/theme.css',
    primary: '#5C2D91',
    enabled: false  // Disabled - set to true to enable
  },
  // Silver theme (Gray) - for Apple style minimalist
  'silver-light': {
    id: 'silver-light',
    name: 'Silver Light',
    variant: 'light',
    brand: 'silver',
    brandDisplayName: 'Silver',
    logo: './themes/silver/logo.svg',
    logoLight: './themes/silver/logo-light.svg',
    logoDark: './themes/silver/logo-dark.svg',
    cssPath: './themes/silver-light/theme.css',
    primary: '#6B7280',
    enabled: false  // Disabled - set to true to enable
  },
  'silver-dark': {
    id: 'silver-dark',
    name: 'Silver Dark',
    variant: 'dark',
    brand: 'silver',
    brandDisplayName: 'Silver',
    logo: './themes/silver/logo.svg',
    logoLight: './themes/silver/logo-light.svg',
    logoDark: './themes/silver/logo-dark.svg',
    cssPath: './themes/silver-dark/theme.css',
    primary: '#6B7280',
    enabled: false  // Disabled - set to true to enable
  },
  // Amber theme (Orange/Gold) - warm accent option
  'amber-light': {
    id: 'amber-light',
    name: 'Amber Light',
    variant: 'light',
    brand: 'amber',
    brandDisplayName: 'Amber',
    logo: './themes/amber/logo.svg',
    logoLight: './themes/amber/logo-light.svg',
    logoDark: './themes/amber/logo-dark.svg',
    cssPath: './themes/amber-light/theme.css',
    primary: '#F0AB00',
    enabled: false  // Disabled - set to true to enable
  },
  'amber-dark': {
    id: 'amber-dark',
    name: 'Amber Dark',
    variant: 'dark',
    brand: 'amber',
    brandDisplayName: 'Amber',
    logo: './themes/amber/logo.svg',
    logoLight: './themes/amber/logo-light.svg',
    logoDark: './themes/amber/logo-dark.svg',
    cssPath: './themes/amber-dark/theme.css',
    primary: '#F0AB00',
    enabled: false  // Disabled - set to true to enable
  },
  // Sapphire theme (Blue) - for SAP style
  'sapphire-light': {
    id: 'sapphire-light',
    name: 'Sapphire Light',
    variant: 'light',
    brand: 'sapphire',
    brandDisplayName: 'Sapphire',
    logo: './themes/sapphire/logo.svg',
    logoLight: './themes/sapphire/logo-light.svg',
    logoDark: './themes/sapphire/logo-dark.svg',
    cssPath: './themes/sapphire-light/theme.css',
    primary: '#0070F2',
    enabled: false  // Disabled - set to true to enable
  },
  'sapphire-dark': {
    id: 'sapphire-dark',
    name: 'Sapphire Dark',
    variant: 'dark',
    brand: 'sapphire',
    brandDisplayName: 'Sapphire',
    logo: './themes/sapphire/logo.svg',
    logoLight: './themes/sapphire/logo-light.svg',
    logoDark: './themes/sapphire/logo-dark.svg',
    cssPath: './themes/sapphire-dark/theme.css',
    primary: '#0070F2',
    enabled: false  // Disabled - set to true to enable
  }
};

export const DEFAULT_THEME = 'teal-light';

// Get all themes (including disabled)
export const getThemeList = () => Object.values(THEME_CONFIG);

// Get only enabled themes (for UI display)
export const getEnabledThemes = () => Object.values(THEME_CONFIG).filter(t => t.enabled !== false);

export const getTheme = (id) => THEME_CONFIG[id] || THEME_CONFIG[DEFAULT_THEME];

export const getThemesByBrand = () => {
  const brands = {};
  Object.values(THEME_CONFIG).forEach(theme => {
    if (!brands[theme.brand]) {
      brands[theme.brand] = {
        label: theme.brandDisplayName,
        themes: []
      };
    }
    brands[theme.brand].themes.push(theme);
  });
  return brands;
};

// Apply theme to document
export const applyTheme = (themeId, doc = document) => {
  const themes = getThemeList();
  themes.forEach(theme => {
    const link = doc.getElementById(`theme-${theme.id}`);
    if (link) {
      link.rel = theme.id === themeId ? 'stylesheet' : 'prefetch';
    }
  });
};

