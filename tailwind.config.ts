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
        // Atheneum Design System - 蓝色主题
        primary: {
          DEFAULT: '#0058be',
          container: '#2170e4',
          fixed: '#d8e2ff',
          'fixed-dim': '#adc6ff',
        },
        secondary: {
          DEFAULT: '#495e8a',
          container: '#b6ccff',
          fixed: '#d8e2ff',
          'fixed-dim': '#b1c6f9',
        },
        tertiary: {
          DEFAULT: '#924700',
          container: '#b75b00',
          fixed: '#ffdcc6',
          'fixed-dim': '#ffb786',
        },
        surface: {
          DEFAULT: '#f7f9fb',
          dim: '#d8dadc',
          bright: '#f7f9fb',
          variant: '#e0e3e5',
          tint: '#005ac2',
          container: {
            DEFAULT: '#eceef0',
            low: '#f2f4f6',
            'lowest': '#ffffff',
            high: '#e6e8ea',
            highest: '#e0e3e5',
          },
        },
        background: '#f7f9fb',
        outline: {
          DEFAULT: '#727785',
          variant: '#c2c6d6',
        },
        error: {
          DEFAULT: '#ba1a1a',
          container: '#ffdad6',
        },
        // 兼容性保留
        'on-surface': '#191c1e',
        'on-surface-variant': '#424754',
        'on-primary': '#ffffff',
        'on-secondary': '#ffffff',
        'on-tertiary': '#ffffff',
        'on-background': '#191c1e',
        'inverse-primary': '#adc6ff',
        'inverse-surface': '#2d3133',
        'inverse-on-surface': '#eff1f3',
      },
      fontFamily: {
        headline: ['Manrope', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        body: ['Inter', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        label: ['Inter', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'card': '0 12px 40px rgba(25, 28, 30, 0.06)',
        'floating': '0 8px 30px rgba(0, 0, 0, 0.04)',
        'elevated': '0 20px 50px rgba(0, 0, 0, 0.04)',
      },
    },
  },
  plugins: [],
}
