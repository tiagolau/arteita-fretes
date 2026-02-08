import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        arteita: {
          blue: {
            50: '#E8EEF5',
            100: '#C5D4E6',
            200: '#9BB5D1',
            300: '#7196BC',
            400: '#4A77A7',
            500: '#1B3A5C',
            600: '#183353',
            700: '#142C49',
            800: '#10233A',
            900: '#0C1A2B',
          },
          gold: {
            50: '#FEF6E0',
            100: '#FDE9B3',
            200: '#FBDB80',
            300: '#F9CD4D',
            400: '#F6BC1A',
            500: '#F2A900',
            600: '#D99800',
            700: '#B37D00',
            800: '#8C6200',
            900: '#664700',
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;
