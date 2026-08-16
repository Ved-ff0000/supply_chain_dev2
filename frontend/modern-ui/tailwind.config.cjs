module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        accent: '#4F46E5', // slate blue accent for antigravity
        accentCyan: '#0EA5E9',
        surface: '#070709',
        pane: '#0b0b0c'
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      boxShadow: {
        subtle: '0 1px 0 rgba(15,23,36,0.04)'
      }
    }
  },
  plugins: []
};