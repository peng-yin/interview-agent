import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        primary: '#6938ef',
        'primary-light': '#7c5cf7',
        'primary-dark': '#5025d1',
        accent: '#a78bfa',
        surface: '#0c0c0d',
        'surface-1': '#141415',
        'surface-2': '#1c1c1f',
        'surface-3': '#242428',
        'surface-light': '#1c1c1f',
        'surface-border': 'rgba(255, 255, 255, 0.1)',
        brand: {
          50: '#f4f3ff',
          100: '#ebe8ff',
          200: '#d9d3ff',
          300: '#bdb0fe',
          400: '#a78bfa',
          500: '#7c5cf7',
          600: '#6938ef',
          700: '#5925db',
          800: '#4a1fb7',
          900: '#3e1c96',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'spin-slow': 'spin 4s linear infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(105, 56, 239, 0.3)' },
          '100%': { boxShadow: '0 0 40px rgba(105, 56, 239, 0.6)' },
        },
      },
      boxShadow: {
        'glow-sm': '0 0 12px rgba(105, 56, 239, 0.2)',
        'glow-md': '0 0 24px rgba(105, 56, 239, 0.3)',
        'glow-lg': '0 0 40px rgba(105, 56, 239, 0.4)',
        'glow-xl': '0 0 60px rgba(105, 56, 239, 0.5)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};

export default config;
