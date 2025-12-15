// Theme Configuration Registry
// Generic theme names based on primary colors (not brand names)

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
    isDefault: true
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
    primary: '#00C895'
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
    primary: '#76B900'
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
    primary: '#76B900'
  }
};

export const DEFAULT_THEME = 'teal-light';

export const getThemeList = () => Object.values(THEME_CONFIG);

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

