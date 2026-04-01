export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: '#FFFFFF',
        card: '#FFFFFF',
        'card-border': '#EBEBEB',
        primary: '#1A1A1A',
        secondary: '#999',
        muted: '#C8C8C8',
        divider: '#F0F0F0',
        hover: '#F5F5F5',
      },
      borderRadius: {
        card: '16px',
        btn: '10px',
        input: '10px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Helvetica Neue', 'Arial', 'Microsoft YaHei', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
