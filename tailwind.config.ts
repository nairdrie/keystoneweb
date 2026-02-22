import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    colors: {
      // Keep all default colors
      inherit: 'inherit',
      transparent: 'transparent',
      current: 'currentColor',
      
      // Grayscale + core colors
      white: '#ffffff',
      black: '#000000',
      slate: {
        50: '#f8fafc',
        100: '#f1f5f9',
        200: '#e2e8f0',
        300: '#cbd5e1',
        400: '#94a3b8',
        500: '#64748b',
        600: '#475569',
        700: '#334155',
        800: '#1e293b',
        900: '#0f172a',
      },
      gray: {
        50: '#f9fafb',
        100: '#f3f4f6',
        200: '#e5e7eb',
        300: '#d1d5db',
        400: '#9ca3af',
        500: '#6b7280',
        600: '#4b5563',
        700: '#374151',
        800: '#1f2937',
        900: '#111827',
      },
      
      // Brand red - now uses #ff5f5f
      red: {
        50: '#fff5f5',
        100: '#ffe6e6',
        200: '#ffcccc',
        300: '#ffb3b3',
        400: '#ff9999',
        500: '#ff7f7f',
        600: '#ff5f5f', // Primary brand color
        700: '#f54545', // Hover state
        800: '#e54545', // Active state
        900: '#cc2525', // Dark state
      },
    },
  },
  plugins: [],
};

export default config;
