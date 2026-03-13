import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Zen Old Mincho"', 'serif'],
        sans: ['"Zen Old Mincho"', 'serif'],
      },
      colors: {
        // Brand olive #787354
        primary: {
          50: '#f5f4f0',
          100: '#e8e6dd',
          200: '#d1cebb',
          300: '#b5b193',
          400: '#9a9573',
          500: '#787354',
          600: '#635f46',
          700: '#504d3a',
          800: '#3d3b2e',
          900: '#2b2a21',
          950: '#1a1914',
        },
        // Accent gold for CTAs - high contrast
        accent: {
          50: '#fdf9ef',
          100: '#faf0d0',
          200: '#f4e0a1',
          300: '#e9c964',
          400: '#ddb63e',
          500: '#C8A94E',
          600: '#b08a28',
          700: '#8c6a20',
          800: '#6b5119',
          900: '#4a3812',
        },
        // Standard semantic - clear & recognizable
        success: {
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        info: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
      borderRadius: {
        'card': '1rem',
        'btn': '0.5rem',
        'input': '0.375rem',
        'badge': '9999px',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover': '0 10px 25px rgba(0,0,0,0.1)',
        'header': '0 1px 3px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
