/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Material Design 3 风格 - 来自 Stitch 设计
        primary: {
          DEFAULT: '#423fc0',
          container: '#5b59d9',
          fixed: '#e2dfff',
          'fixed-dim': '#c2c1ff',
        },
        secondary: {
          DEFAULT: '#8d2ebc',
          container: '#d072ff',
          fixed: '#f6d9ff',
          'fixed-dim': '#e8b3ff',
        },
        tertiary: {
          DEFAULT: '#764700',
          container: '#975d00',
          fixed: '#ffddba',
          'fixed-dim': '#ffb964',
        },
        surface: {
          DEFAULT: '#f9f9fe',
          dim: '#d9dade',
          bright: '#f9f9fe',
          variant: '#e2e2e7',
          tint: '#4f4ccd',
          container: {
            DEFAULT: '#ededf2',
            low: '#f3f3f8',
            'lowest': '#ffffff',
            high: '#e8e8ed',
            highest: '#e2e2e7',
          },
        },
        background: '#f9f9fe',
        outline: {
          DEFAULT: '#797584',
          variant: '#cac4d5',
        },
        error: {
          DEFAULT: '#ba1a1a',
          container: '#ffdad6',
        },
      },
      fontFamily: {
        headline: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'card': '0 20px 40px rgba(26, 28, 31, 0.06)',
        'floating': '0 8px 32px rgba(66, 63, 192, 0.12)',
      },
    },
  },
  plugins: [],
}
