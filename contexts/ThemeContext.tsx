import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, ColorSchemeName } from 'react-native';
import { EXCOMM_UI } from '@/lib/excommUiTokens';

type ThemeMode = 'light' | 'dark' | 'system';

interface ColorPalette {
  // Primary colors
  primary: string;
  primaryLight: string;
  primaryDark: string;
  
  // Secondary colors
  secondary: string;
  secondaryLight: string;
  secondaryDark: string;
  
  // Accent colors
  accent: string;
  accentLight: string;
  accentDark: string;
  
  // Status colors
  success: string;
  successLight: string;
  successDark: string;
  
  warning: string;
  warningLight: string;
  warningDark: string;
  
  error: string;
  errorLight: string;
  errorDark: string;
  
  info: string;
  infoLight: string;
  infoDark: string;
  
  // Neutral colors
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceSecondary: string;
  
  // Text colors
  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  
  // Border and divider colors
  border: string;
  borderLight: string;
  borderDark: string;
  divider: string;
  
  // Interactive colors
  interactive: string;
  interactiveHover: string;
  interactivePressed: string;
  interactiveDisabled: string;
  
  // Overlay colors
  overlay: string;
  overlayLight: string;
  overlayDark: string;
  
  // Shadow colors
  shadow: string;
  shadowLight: string;
  shadowDark: string;
}

interface Typography {
  // Font families
  fontFamily: {
    regular: string;
    medium: string;
    semiBold: string;
    bold: string;
    light: string;
  };
  
  // Font sizes
  fontSize: {
    xs: number;
    sm: number;
    base: number;
    lg: number;
    xl: number;
    '2xl': number;
    '3xl': number;
    '4xl': number;
    '5xl': number;
    '6xl': number;
  };
  
  // Line heights
  lineHeight: {
    tight: number;
    normal: number;
    relaxed: number;
    loose: number;
  };
  
  // Letter spacing
  letterSpacing: {
    tight: number;
    normal: number;
    wide: number;
  };
}

interface Spacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  '2xl': number;
  '3xl': number;
  '4xl': number;
  '5xl': number;
  '6xl': number;
}

interface BorderRadius {
  none: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  '2xl': number;
  '3xl': number;
  full: number;
}

interface Shadows {
  none: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
}

interface Theme {
  mode: 'light' | 'dark';
  colors: ColorPalette;
  typography: Typography;
  spacing: Spacing;
  borderRadius: BorderRadius;
  shadows: Shadows;
}

// Light theme configuration - Pure White LinkedIn Style
const lightTheme: Theme = {
  mode: 'light',
  colors: {
    // Primary colors (LinkedIn Blue)
    primary: '#0a66c2',
    primaryLight: '#378fe9',
    primaryDark: '#004182',
    
    // Secondary colors (Professional Gray)
    secondary: '#666666',
    secondaryLight: '#8a8a8a',
    secondaryDark: '#404040',
    
    // Accent colors
    accent: '#8b5cf6',
    accentLight: '#a78bfa',
    accentDark: '#7c3aed',
    
    // Status colors
    success: '#057a55',
    successLight: '#16a34a',
    successDark: '#15803d',
    
    warning: '#d97706',
    warningLight: '#f59e0b',
    warningDark: '#b45309',
    
    error: '#dc2626',
    errorLight: '#ef4444',
    errorDark: '#b91c1c',
    
    info: '#0891b2',
    infoLight: '#06b6d4',
    infoDark: '#0e7490',
    
    // Pure White Neutral colors
    background: '#ffffff',
    backgroundSecondary: '#ffffff',
    surface: '#ffffff',
    surfaceSecondary: '#ffffff',
    
    // Professional Text colors
    text: '#000000',
    textSecondary: '#666666',
    textTertiary: '#999999',
    textInverse: '#ffffff',
    
    // Subtle Border colors
    border: '#e0e0e0',
    borderLight: '#f0f0f0',
    borderDark: '#cccccc',
    divider: '#e0e0e0',
    
    // Interactive colors
    interactive: '#0a66c2',
    interactiveHover: '#004182',
    interactivePressed: '#003366',
    interactiveDisabled: '#cccccc',
    
    // Overlay colors
    overlay: 'rgba(0, 0, 0, 0.4)',
    overlayLight: 'rgba(0, 0, 0, 0.2)',
    overlayDark: 'rgba(0, 0, 0, 0.6)',
    
    // Subtle Shadow colors
    shadow: 'rgba(0, 0, 0, 0.08)',
    shadowLight: 'rgba(0, 0, 0, 0.04)',
    shadowDark: 'rgba(0, 0, 0, 0.12)',
  },
  typography: {
    fontFamily: {
      regular: 'System',
      medium: 'System',
      semiBold: 'System',
      bold: 'System',
      light: 'System',
    },
    fontSize: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 30,
      '4xl': 36,
      '5xl': 48,
      '6xl': 60,
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.6,
      loose: 1.8,
    },
    letterSpacing: {
      tight: -0.5,
      normal: 0,
      wide: 0.5,
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
    '3xl': 64,
    '4xl': 80,
    '5xl': 96,
    '6xl': 128,
  },
  borderRadius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    '2xl': 24,
    '3xl': 32,
    full: 9999,
  },
  shadows: {
    none: 'none',
    sm: '0 1px 3px rgba(0, 0, 0, 0.05)',
    md: '0 2px 8px rgba(0, 0, 0, 0.08)',
    lg: '0 4px 16px rgba(0, 0, 0, 0.1)',
    xl: '0 8px 24px rgba(0, 0, 0, 0.12)',
    '2xl': '0 16px 40px rgba(0, 0, 0, 0.15)',
  },
};

// Dark theme configuration
const darkTheme: Theme = {
  mode: 'dark',
  colors: {
    // Primary colors (LinkedIn Blue - adjusted for dark mode)
    primary: '#70b5f9',
    primaryLight: '#93c5fd',
    primaryDark: '#0a66c2',
    
    // Secondary colors
    secondary: '#9ca3af',
    secondaryLight: '#d1d5db',
    secondaryDark: '#6b7280',
    
    // Accent colors
    accent: '#a78bfa',
    accentLight: '#c4b5fd',
    accentDark: '#8b5cf6',
    
    // Status colors
    success: '#34d399',
    successLight: '#6ee7b7',
    successDark: '#10b981',
    
    warning: '#fbbf24',
    warningLight: '#fcd34d',
    warningDark: '#f59e0b',
    
    error: '#f87171',
    errorLight: '#fca5a5',
    errorDark: '#ef4444',
    
    info: '#22d3ee',
    infoLight: '#67e8f9',
    infoDark: '#06b6d4',
    
    // Dark mode backgrounds
    background: '#1a1a1a',
    backgroundSecondary: '#2a2a2a',
    surface: '#2a2a2a',
    surfaceSecondary: '#3a3a3a',
    
    // Dark mode text colors
    text: '#ffffff',
    textSecondary: '#cccccc',
    textTertiary: '#999999',
    textInverse: '#000000',
    
    // Dark mode borders
    border: '#404040',
    borderLight: '#505050',
    borderDark: '#303030',
    divider: '#404040',
    
    // Interactive colors
    interactive: '#70b5f9',
    interactiveHover: '#93c5fd',
    interactivePressed: '#60a5fa',
    interactiveDisabled: '#666666',
    
    // Overlay colors
    overlay: 'rgba(0, 0, 0, 0.7)',
    overlayLight: 'rgba(0, 0, 0, 0.5)',
    overlayDark: 'rgba(0, 0, 0, 0.9)',
    
    // Shadow colors
    shadow: 'rgba(0, 0, 0, 0.3)',
    shadowLight: 'rgba(0, 0, 0, 0.2)',
    shadowDark: 'rgba(0, 0, 0, 0.5)',
  },
  typography: {
    fontFamily: {
      regular: 'System',
      medium: 'System',
      semiBold: 'System',
      bold: 'System',
      light: 'System',
    },
    fontSize: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 30,
      '4xl': 36,
      '5xl': 48,
      '6xl': 60,
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.6,
      loose: 1.8,
    },
    letterSpacing: {
      tight: -0.5,
      normal: 0,
      wide: 0.5,
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
    '3xl': 64,
    '4xl': 80,
    '5xl': 96,
    '6xl': 128,
  },
  borderRadius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    '2xl': 24,
    '3xl': 32,
    full: 9999,
  },
  shadows: {
    none: 'none',
    sm: '0 1px 3px rgba(0, 0, 0, 0.2)',
    md: '0 2px 8px rgba(0, 0, 0, 0.25)',
    lg: '0 4px 16px rgba(0, 0, 0, 0.3)',
    xl: '0 8px 24px rgba(0, 0, 0, 0.35)',
    '2xl': '0 16px 40px rgba(0, 0, 0, 0.4)',
  },
};

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
  
  // Utility functions
  getColor: (colorPath: string) => string;
  getSpacing: (size: keyof Spacing) => number;
  getFontSize: (size: keyof Typography['fontSize']) => number;
  getBorderRadius: (size: keyof BorderRadius) => number;
  getShadow: (size: keyof Shadows) => string;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const THEME_STORAGE_KEY = 'toastmaster360_theme_mode';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light'); // Default to light mode
  const [systemColorScheme, setSystemColorScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme()
  );

  // Determine the actual theme to use - Force light mode for now
  const getActiveTheme = (): Theme => {
    // Always return light theme for now to ensure white background
    return lightTheme;
  };

  const theme = getActiveTheme();
  const isDark = false; // Force light mode

  // Load saved theme preference on app start
  useEffect(() => {
    loadThemePreference();
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemColorScheme(colorScheme);
    });

    return () => subscription?.remove();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        setThemeModeState('light'); // Force light mode for now
      }
    } catch (error) {
      console.warn('Failed to load theme preference:', error);
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      setThemeModeState('light'); // Force light mode for now
      await AsyncStorage.setItem(THEME_STORAGE_KEY, 'light');
    } catch (error) {
      console.warn('Failed to save theme preference:', error);
    }
  };

  const toggleTheme = async () => {
    // Keep light mode for now
    await setThemeMode('light');
  };

  // Utility function to get color by path (e.g., 'primary', 'text', 'success')
  const getColor = (colorPath: string): string => {
    const keys = colorPath.split('.');
    let value: any = theme.colors;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        console.warn(`Color path '${colorPath}' not found in theme`);
        return theme.colors.primary; // Fallback
      }
    }
    
    return typeof value === 'string' ? value : theme.colors.primary;
  };

  // Utility function to get spacing
  const getSpacing = (size: keyof Spacing): number => {
    return theme.spacing[size] || theme.spacing.md;
  };

  // Utility function to get font size
  const getFontSize = (size: keyof Typography['fontSize']): number => {
    return theme.typography.fontSize[size] || theme.typography.fontSize.base;
  };

  // Utility function to get border radius
  const getBorderRadius = (size: keyof BorderRadius): number => {
    return theme.borderRadius[size] || theme.borderRadius.md;
  };

  // Utility function to get shadow
  const getShadow = (size: keyof Shadows): string => {
    return theme.shadows[size] || theme.shadows.md;
  };

  const contextValue: ThemeContextType = {
    theme,
    themeMode: 'light',
    isDark: false,
    setThemeMode,
    toggleTheme,
    getColor,
    getSpacing,
    getFontSize,
    getBorderRadius,
    getShadow,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// Theme utility hooks for common use cases
const useColors = () => {
  const { theme } = useTheme();
  return theme.colors;
};

const useTypography = () => {
  const { theme } = useTheme();
  return theme.typography;
};

const useSpacing = () => {
  const { theme } = useTheme();
  return theme.spacing;
};

const useBorderRadius = () => {
  const { theme } = useTheme();
  return theme.borderRadius;
};

const useShadows = () => {
  const { theme } = useTheme();
  return theme.shadows;
};

// Role-specific color utilities for Toastmasters roles
const getRoleColor = (role: string): string => {
  switch (role.toLowerCase()) {
    case 'excomm': return EXCOMM_UI.solidBg;
    case 'visiting_tm': return '#10b981';
    case 'club_leader': return '#f59e0b';
    case 'guest': return '#6b7280';
    case 'member': return '#0a66c2';
    default: return '#6b7280';
  }
};

const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'active':
    case 'open':
    case 'present':
    case 'completed':
    case 'success': return '#057a55';
    case 'pending':
    case 'warning':
    case 'late': return '#d97706';
    case 'inactive':
    case 'closed':
    case 'absent':
    case 'error':
    case 'failed': return '#dc2626';
    case 'info':
    case 'draft': return '#0891b2';
    default: return '#6b7280';
  }
};

// Meeting mode color utilities
const getMeetingModeColor = (mode: string): string => {
  switch (mode.toLowerCase()) {
    case 'in_person': return '#057a55';
    case 'online': return '#0a66c2';
    case 'hybrid': return '#8b5cf6';
    default: return '#6b7280';
  }
};

// Priority level color utilities
const getPriorityColor = (priority: string): string => {
  switch (priority.toLowerCase()) {
    case 'high':
    case 'urgent': return '#dc2626';
    case 'medium':
    case 'normal': return '#d97706';
    case 'low': return '#057a55';
    default: return '#6b7280';
  }
};

// Export theme objects for direct access if needed
;