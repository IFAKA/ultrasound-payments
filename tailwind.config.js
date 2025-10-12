/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Custom color scheme matching the existing design
        bg: '#0b0b0b',
        card: '#121212',
        muted: '#9aa0a6',
        text: '#e8eaed',
        accent: '#8ab4f8',
        ok: '#34d399',
        err: '#f87171',
        border: '#1f1f1f',
        success: '#10b981',
        warning: '#f59e0b',
        primary: '#8ab4f8',
        'primary-hover': '#7c9ef8',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['monospace'],
      },
      animation: {
        'pulse-glow': 'pulseGlow 1.5s ease-in-out infinite',
        'pulse-glow-green': 'pulseGlowGreen 1.5s ease-in-out infinite',
        'success-bounce': 'successBounce 0.3s ease-out',
        'message-slide': 'messageSlide 0.3s ease-out',
        'history-slide': 'historySlide 0.3s ease-out',
      },
      keyframes: {
        pulseGlow: {
          '0%': {
            boxShadow: '0 0 5px rgba(138, 180, 248, 0.3), 0 0 10px rgba(138, 180, 248, 0.2), 0 0 15px rgba(138, 180, 248, 0.1)',
            borderColor: 'rgba(138, 180, 248, 0.8)',
          },
          '50%': {
            boxShadow: '0 0 20px rgba(138, 180, 248, 0.6), 0 0 30px rgba(138, 180, 248, 0.4), 0 0 40px rgba(138, 180, 248, 0.2)',
            borderColor: 'rgba(138, 180, 248, 1)',
          },
          '100%': {
            boxShadow: '0 0 5px rgba(138, 180, 248, 0.3), 0 0 10px rgba(138, 180, 248, 0.2), 0 0 15px rgba(138, 180, 248, 0.1)',
            borderColor: 'rgba(138, 180, 248, 0.8)',
          },
        },
        pulseGlowGreen: {
          '0%': {
            boxShadow: '0 0 5px rgba(52, 211, 153, 0.3), 0 0 10px rgba(52, 211, 153, 0.2), 0 0 15px rgba(52, 211, 153, 0.1)',
            borderColor: 'rgba(52, 211, 153, 0.8)',
          },
          '50%': {
            boxShadow: '0 0 20px rgba(52, 211, 153, 0.6), 0 0 30px rgba(52, 211, 153, 0.4), 0 0 40px rgba(52, 211, 153, 0.2)',
            borderColor: 'rgba(52, 211, 153, 1)',
          },
          '100%': {
            boxShadow: '0 0 5px rgba(52, 211, 153, 0.3), 0 0 10px rgba(52, 211, 153, 0.2), 0 0 15px rgba(52, 211, 153, 0.1)',
            borderColor: 'rgba(52, 211, 153, 0.8)',
          },
        },
        successBounce: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.02)' },
          '100%': { transform: 'scale(1)' },
        },
        messageSlide: {
          from: {
            opacity: '0',
            transform: 'translateY(10px)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        historySlide: {
          from: {
            opacity: '0',
            transform: 'translateX(-10px)',
          },
          to: {
            opacity: '1',
            transform: 'translateX(0)',
          },
        },
      },
      spacing: {
        'sidebar': '280px',
        'sidebar-collapsed': '60px',
      },
      maxWidth: {
        '8xl': '88rem',
        '9xl': '96rem',
      },
    },
  },
  plugins: [],
}
