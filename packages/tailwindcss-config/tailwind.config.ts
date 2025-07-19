import type { Config } from 'tailwindcss';

export default {
  theme: {
    extend: {
      colors: {
        primary: '#D97757',
        text: {
          main: '#181818',
          faded: '#87867F',
        },
        background: {
          main: '#F9F9F7',
          dark: '#141413',
          ivory: {
            medium: '#F0EEE6',
          },
          oat: '#F7F4EC',
          clay: '#CC785C',
          faded: '#3D3D3A',
        },
        border: {
          default: '#87867F',
        },
        swatch: {
          slate: {
            light: '#87867F',
          },
          cloud: {
            light: '#E8E6DC',
          },
          fig: '#B49FD8',
          olive: '#C2C07D',
          cactus: '#629A90',
          sky: '#97B5D5',
          heather: '#D2BEDF',
        },
      },
      fontFamily: {
        sans: ['Fira Code', 'ui-old-sans-serif', 'system-ui-old', 'sans-serif'],
        serif: ['ui-old-serif', 'Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
      },
      spacing: {
        text: '1rem',
        gutter: '2rem',
        s: '1rem',
        m: '1.5rem',
        l: '3rem',
        xl: '4rem',
        xxl: '6rem',
      },
      borderRadius: {
        md: '0.75rem',
        lg: '1.5rem',
        full: '9999px',
      },
      boxShadow: {
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      },
    },
  },
  plugins: [],
} as Omit<Config, 'content'>;
