/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			bg: '#0b0b0b',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			text: '#e8eaed',
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			ok: '#34d399',
  			err: '#f87171',
  			border: 'hsl(var(--border))',
  			success: '#10b981',
  			warning: '#f59e0b',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			'primary-hover': '#7c9ef8',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		fontFamily: {
  			sans: [
  				'system-ui',
  				'-apple-system',
  				'Segoe UI',
  				'Roboto',
  				'Helvetica',
  				'Arial',
  				'sans-serif'
  			],
  			mono: [
  				'monospace'
  			]
  		},
  		animation: {
			'pulse-glow': 'pulseGlow 40s linear infinite',
			'pulse-glow-green': 'pulseGlowGreen 40s linear infinite',
			'success-bounce': 'successBounce 1.5s ease-out',
  			'message-slide': 'messageSlide 0.3s ease-out',
  			'history-slide': 'historySlide 0.3s ease-out'
  		},
  		keyframes: {
			pulseGlow: {
				'0%': {
					boxShadow: '0 0 2px rgba(138, 180, 248, 0.08)',
					borderColor: 'rgba(138, 180, 248, 0.40)'
				},
				'50%': {
					boxShadow: '0 0 2px rgba(138, 180, 248, 0.08)',
					borderColor: 'rgba(138, 180, 248, 0.55)'
				},
				'100%': {
					boxShadow: '0 0 2px rgba(138, 180, 248, 0.08)',
					borderColor: 'rgba(138, 180, 248, 0.40)'
				}
			},
			pulseGlowGreen: {
				'0%': {
					boxShadow: '0 0 2px rgba(52, 211, 153, 0.08)',
					borderColor: 'rgba(52, 211, 153, 0.40)'
				},
				'50%': {
					boxShadow: '0 0 2px rgba(52, 211, 153, 0.08)',
					borderColor: 'rgba(52, 211, 153, 0.55)'
				},
				'100%': {
					boxShadow: '0 0 2px rgba(52, 211, 153, 0.08)',
					borderColor: 'rgba(52, 211, 153, 0.40)'
				}
			},
  			successBounce: {
  				'0%': {
  					transform: 'scale(1)'
  				},
  				'50%': {
  					transform: 'scale(1.02)'
  				},
  				'100%': {
  					transform: 'scale(1)'
  				}
  			},
  			messageSlide: {
  				from: {
  					opacity: '0',
  					transform: 'translateY(10px)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			historySlide: {
  				from: {
  					opacity: '0',
  					transform: 'translateX(-10px)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'translateX(0)'
  				}
  			}
  		},
  		spacing: {
  			sidebar: '280px',
  			'sidebar-collapsed': '60px'
  		},
  		maxWidth: {
  			'8xl': '88rem',
  			'9xl': '96rem'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
