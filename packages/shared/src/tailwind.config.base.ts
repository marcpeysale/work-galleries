import type { Config } from 'tailwindcss';

export const tailwindBase = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#0d0d0d',
        surface: '#141414',
        elevated: '#1c1c1c',
        accent: {
          DEFAULT: '#c0392b',
          hover: '#e74c3c',
        },
        'text-primary': '#f0f0f0',
        muted: '#a0a0a0',
        faint: '#888888',
        border: 'rgba(255,255,255,0.07)',
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        body: ['Manrope', 'sans-serif'],
      },
      maxWidth: {
        wrap: '1280px',
      },
    },
  },
} satisfies Partial<Config>;
