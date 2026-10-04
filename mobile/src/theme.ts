/**
 * OpenJam mobile design tokens.
 * Mirrors docs/UI_UX_BRIEF.md — "Vinyl & Analog Dark".
 */

export const colors = {
  bgBase: '#08080a', // global dark canvas
  bgSurface: '#0e0e12', // static card backgrounds
  bgCard: 'rgba(18, 18, 24, 0.85)', // glassmorphic overlays
  amber: '#ff9f1c', // brand accent: buttons, highlights, glowing states
  gold: '#ffd23f', // warm highlight transitions
  discord: '#5865F2', // official Discord blurple
  red: '#f43f5e', // danger / room destruction
  green: '#10b981', // success / online presence
  text1: '#f8fafc', // primary titles
  text2: '#94a3b8', // secondary text, labels
  text3: '#64748b', // subtitles, captions
  borderAmber: 'rgba(255, 159, 28, 0.25)', // ambient card borders
  borderGlass: 'rgba(255, 255, 255, 0.08)', // glass card border
  hairline: 'rgba(255, 255, 255, 0.08)', // minimalist hairline dividers
  white: '#ffffff',
  black: '#000000',
} as const;

export const fonts = {
  display: 'Outfit', // page titles, room headers, track titles
  body: 'Poppins', // buttons, lists, chat, settings
} as const;

export const fontWeights = {
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  full: 999,
} as const;

/** Bottom tab bar height (thumb-reachable, per UI brief). */
export const TAB_BAR_HEIGHT = 56;

/** Shared shadow for the warm amber glow on key elements. */
export const glowShadow = {
  shadowColor: colors.amber,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.35,
  shadowRadius: 12,
  elevation: 6,
};
