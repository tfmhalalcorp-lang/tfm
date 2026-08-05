// Loaded AFTER the Tailwind Play CDN <script> tag. Kept in an external file
// (rather than an inline <script>) so the site's CSP can omit 'unsafe-inline'
// from script-src.
tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4CAF50',
          dark: '#388E3C',
          light: '#e8f5e9',
        },
        secondary: '#0288D1',
        accent: '#FBC02D',
        danger: '#D32F2F',
      },
      fontFamily: {
        sans: ['Kanit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
};
