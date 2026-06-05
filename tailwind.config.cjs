/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#e0eaff',
          400: '#7B93F5',
          500: '#4F6BF0',
          600: '#3b54d4',
          700: '#2d40a8',
          900: '#1a2463',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
