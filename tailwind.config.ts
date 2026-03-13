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
        // Primary: #787354 olive base
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
        // Accent: warm gold / brass
        accent: {
          50: '#faf8f0',
          100: '#f3efdb',
          200: '#e7deb5',
          300: '#d9ca88',
          400: '#c9b45e',
          500: '#b89b3e',
          600: '#9a7e30',
          700: '#7c6428',
          800: '#5e4c20',
          900: '#40341a',
        },
        // Warm neutral backgrounds
        warm: {
          50: '#faf9f7',
          100: '#f3f1ed',
          200: '#e8e5de',
          300: '#d5d0c5',
          400: '#b8b1a2',
          500: '#9b9382',
          600: '#7e7666',
          700: '#615b4e',
          800: '#454138',
          900: '#2a2823',
        },
        // Semantic colors (harmonized with olive theme)
        success: {
          50: '#f0f5ee',
          100: '#dce8d6',
          500: '#6b8f5e',
          600: '#567848',
          700: '#416034',
        },
        danger: {
          50: '#f8f0ee',
          100: '#f0dbd6',
          500: '#a05a4a',
          600: '#8a4538',
          700: '#6e3429',
        },
        warning: {
          50: '#f8f4ee',
          100: '#f0e5d6',
          500: '#b08f4a',
          600: '#96763a',
          700: '#7a5e2c',
        },
        info: {
          50: '#eef2f5',
          100: '#d6e0e8',
          500: '#5a7a8f',
          600: '#456478',
          700: '#344e5e',
        },
      },
      borderRadius: {
        'card': '1rem',
        'btn': '0.5rem',
        'input': '0.375rem',
        'badge': '9999px',
      },
      boxShadow: {
        'card': '0 2px 12px rgba(120, 115, 84, 0.08)',
        'card-hover': '0 8px 24px rgba(120, 115, 84, 0.15)',
        'header': '0 1px 4px rgba(120, 115, 84, 0.1)',
      },
      spacing: {
        'nav-h': '4.5rem',
      },
    },
  },
  plugins: [],
};

export default config;
