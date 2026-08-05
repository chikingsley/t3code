/**
 * Mobile UI geometry follows the Daily Report four-point grid.
 * Keep the matching Tailwind theme values in global.css aligned with these.
 */
export const UI_SPACE = {
  inline: 4,
  compact: 8,
  control: 12,
  gutter: 16,
  section: 24,
  screen: 32,
} as const;

export const UI_CONTROL = {
  standard: 44,
  prominent: 48,
  icon: 20,
  chevron: 12,
} as const;
