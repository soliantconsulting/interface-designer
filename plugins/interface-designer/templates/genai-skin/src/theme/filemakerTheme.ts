import { createTheme } from '@mui/material/styles';

/**
 * FileMaker skin.
 *
 * Calibrated against a FileMaker 19+ solution running on macOS. The goal is that a
 * user of the real system recognises this instantly as their own software.
 *
 * Tune FM against the client's actual screenshots before building screens. The values
 * below are a starting point, not a standard.
 */
export const FM = {
  /** Chrome */
  headerBg: '#414E61',
  headerModuleBg: '#37424F',
  headerText: '#FFFFFF',
  toolbarBtnBg: '#4F5E72',
  toolbarBtnHover: '#5C6D83',
  windowBarBg: '#E8E8E8',
  windowBarText: '#3C3C3C',

  /** Surfaces */
  bodyBg: '#FFFFFF',
  panelBg: '#F2F3F5',
  gridHeaderBg: '#E4E7EB',
  rowAltBg: '#F6F7F8',
  rowSelectedBg: '#C6D4E4',
  rowHoverBg: '#EDF1F6',

  /** Lines */
  border: '#D5D9DE',
  borderStrong: '#B8BEC7',
  fieldBorder: '#B8BEC7',

  /** Text */
  text: '#1F2429',
  textMuted: '#5C6672',
  label: '#3C4652',
  link: '#2E5C9A',
  danger: '#CC0000',
  positive: '#2D6A2D',
  accent: '#7B3FA0',

  /** Tinted cells, seen on report layouts */
  tintGreenBg: '#E8F3E4',
  tintGreenText: '#2D6A2D',
  tintBlueBg: '#DCE6F2',
  tintAmberBg: '#FDEBD0',
  tintAmberHeader: '#F5D9A8',

  /** Density */
  rowH: 28,
  rowHTall: 53,
  headerH: 56,
  fieldH: 26,
  fontSize: 13,
  fontSizeSm: 11.5,
  fontSizeHeader: 12,

  /** FileMaker on macOS renders in the system UI stack */
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif',
} as const;

export const filemakerTheme = createTheme({
  palette: {
    mode: 'light',
    background: { default: FM.bodyBg, paper: FM.bodyBg },
    text: { primary: FM.text, secondary: FM.textMuted },
    primary: { main: FM.headerBg },
    error: { main: FM.danger },
    success: { main: FM.positive },
    divider: FM.border,
  },
  typography: {
    fontFamily: FM.font,
    fontSize: FM.fontSize,
    htmlFontSize: 16,
    body1: { fontSize: FM.fontSize, lineHeight: 1.3 },
    body2: { fontSize: FM.fontSizeSm, lineHeight: 1.25 },
    button: { textTransform: 'none', fontSize: FM.fontSize, fontWeight: 500 },
  },
  shape: { borderRadius: 3 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        'html, body, #root': { height: '100%' },
        body: {
          background: FM.bodyBg,
          color: FM.text,
          fontFamily: FM.font,
          fontSize: FM.fontSize,
          // FileMaker does not do smooth font rendering tricks; keep it crisp.
          WebkitFontSmoothing: 'antialiased',
          overflow: 'hidden',
        },
        '*::-webkit-scrollbar': { width: 13, height: 13 },
        '*::-webkit-scrollbar-track': { background: '#F4F5F6' },
        '*::-webkit-scrollbar-thumb': {
          background: '#C3C8CE',
          borderRadius: 7,
          border: '3px solid #F4F5F6',
        },
      },
    },
    MuiButtonBase: { defaultProps: { disableRipple: true } },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { fontSize: 11.5, background: '#2A3441' },
      },
    },
  },
});
