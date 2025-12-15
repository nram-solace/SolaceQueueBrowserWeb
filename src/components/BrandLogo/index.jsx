import { useState } from 'react';
import PropTypes from 'prop-types';
import { useSettings } from '../../providers/SettingsProvider';
import { getTheme, DEFAULT_THEME } from '../../config/themes';
import classes from './styles.module.css';

const SIZES = {
  small: 24,
  medium: 40,
  large: 64
};

export default function BrandLogo({ size = 'medium', variant = 'auto', className = '', style = {} }) {
  const { settings } = useSettings();
  const [imageError, setImageError] = useState(false);
  
  const theme = getTheme(settings.selectedTheme || DEFAULT_THEME);
  
  // Determine which logo variant to use based on background
  const getLogoSrc = () => {
    if (variant === 'light') {
      return theme.logoLight;
    } else if (variant === 'dark') {
      return theme.logoDark;
    }
    // Auto: use light logo on dark backgrounds, dark logo on light backgrounds
    return theme.variant === 'dark' ? theme.logoLight : theme.logoDark;
  };

  const logoSrc = getLogoSrc();
  const heightPx = typeof size === 'number' ? size : SIZES[size] || SIZES.medium;

  // If image fails to load, show text fallback
  if (imageError) {
    return (
      <span 
        className={`${classes.logoFallback} ${className}`}
        style={{ 
          fontSize: `${heightPx * 0.6}px`,
          height: `${heightPx}px`,
          lineHeight: `${heightPx}px`,
          color: theme.primary,
          ...style 
        }}
      >
        {theme.brandDisplayName}
      </span>
    );
  }

  return (
    <img 
      src={logoSrc} 
      alt={`${theme.brandDisplayName} logo`}
      className={`${classes.logo} ${className}`}
      style={{ 
        height: `${heightPx}px`,
        ...style 
      }}
      onError={() => setImageError(true)}
    />
  );
}

BrandLogo.propTypes = {
  size: PropTypes.oneOfType([
    PropTypes.oneOf(['small', 'medium', 'large']),
    PropTypes.number
  ]),
  variant: PropTypes.oneOf(['auto', 'light', 'dark']),
  className: PropTypes.string,
  style: PropTypes.object
};

