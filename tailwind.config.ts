import type { Config } from 'tailwindcss';
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { navy: '#172033', blue: '#1f4e79', mint: '#287a62', canvas: '#eef1f5' },
      boxShadow: { card: '0 1px 2px rgba(16,24,40,.05)' },
    },
  },
  plugins: [],
} satisfies Config;
