import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand color - primary red (#ff5f5f) with variants
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
  },
  plugins: [],
};

export default config;
