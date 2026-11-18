/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#07101e',
          900: '#0B192C',
          850: '#132742',
          800: '#1E3E62',
          700: '#2b527d',
          600: '#3d6c9e',
        },
        brand: {
          royal: '#2455C5',
          ocean: '#168CCB',
          mint: '#18D6B5',
          teal: '#18D6B5',
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0284c7',
          600: '#0369a1',
          700: '#075985',
          800: '#0c4a6e',
        },
        surface: {
          page: '#f8fafc',
          card: '#ffffff',
          subtle: '#f1f5f9',
          border: '#e2e8f0',
        },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(110deg, #2455C5 0%, #168CCB 52%, #18D6B5 100%)',
        'brand-gradient-hover': 'linear-gradient(110deg, #1d46a8 0%, #1279b0 52%, #14b89b 100%)',
        'brand-gradient-subtle': 'linear-gradient(135deg, rgba(36, 85, 197, 0.08) 0%, rgba(22, 140, 203, 0.06) 50%, rgba(24, 214, 181, 0.08) 100%)',
      },
      fontFamily: {
        heading: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        body: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        card: '0 4px 20px -2px rgba(11, 25, 44, 0.06), 0 2px 6px -1px rgba(11, 25, 44, 0.04)',
        'card-hover': '0 20px 25px -5px rgba(11, 25, 44, 0.1), 0 8px 10px -6px rgba(11, 25, 44, 0.06)',
        glass: '0 8px 32px 0 rgba(11, 25, 44, 0.12)',
        glow: '0 0 25px -5px rgba(2, 132, 199, 0.35)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
