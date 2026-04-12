import { darkTheme, type GlobalThemeOverrides } from 'naive-ui'

/**
 * Neon accent palette
 * BoB's signature: neon cyan (#00FFDD)
 */
export const neon = {
  cyan: '#00FFDD',     // BoB's color
  pink: '#FF10F0',     // errors, delete
  green: '#39FF14',    // success, completed
  yellow: '#CCFF00',   // warnings, paused
  purple: '#BF40FF',   // primary actions
  orange: '#FF6B2B',   // activity, working
}

export const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: neon.purple,
    primaryColorHover: '#D06FFF',
    primaryColorPressed: '#A020F0',
    primaryColorSuppl: neon.purple,
    borderRadius: '8px',
    bodyColor: '#0D0D0F',
    cardColor: '#161619',
    modalColor: '#161619',
    popoverColor: '#161619',
    tableColor: '#161619',
    inputColor: '#111113',
    actionColor: '#111113',
    borderColor: '#2a2a2e',
    dividerColor: '#2a2a2e',
    hoverColor: '#1e1e22',
    successColor: neon.green,
    warningColor: neon.yellow,
    errorColor: neon.pink,
    textColorBase: '#f0f0f0',
    textColor1: '#f0f0f0',
    textColor2: '#b0b0b8',
    textColor3: '#707078',
    placeholderColor: '#505058',
  },
  Card: {
    borderRadius: '12px',
    color: '#161619',
    borderColor: '#2a2a2e',
  },
  Button: {
    borderRadiusMedium: '8px',
  },
  Input: {
    color: '#111113',
    borderColor: '#2a2a2e',
    borderHover: neon.purple,
    borderFocus: neon.purple,
  },
  Menu: {
    color: 'transparent',
    itemColorActive: '#1e1e22',
    itemColorActiveHover: '#1e1e22',
    itemTextColorActive: '#f0f0f0',
    itemTextColorActiveHover: '#f0f0f0',
    itemIconColorActive: neon.cyan,
    itemIconColorActiveHover: neon.cyan,
  },
}

export { darkTheme }
