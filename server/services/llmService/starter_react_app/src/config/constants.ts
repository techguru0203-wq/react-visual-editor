export const API_CONFIG = {
  API_URL: import.meta.env.VITE_API_URL || '',
} as const;

export const UI_CONFIG = {
  MOBILE_BREAKPOINT: 768,
} as const;
