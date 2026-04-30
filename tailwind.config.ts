import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}','./components/**/*.{js,ts,jsx,tsx}','./lib/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT:'#0D0F14' },
        fog: { DEFAULT:'#F5F3EE', 2:'#EAE7E0', border:'#D6D1C8' },
        amber: { DEFAULT:'#E8A020', 2:'#C8841A' },
        // Legacy aliases — keep for dashboard/app pages that still use them
        navy: { DEFAULT:'#0D0F14', 2:'#161920' },
        teal: { DEFAULT:'#E8A020', 2:'#C8841A' },
        bb: {
          navy:'#0D0F14', navy2:'#161920',
          teal:'#E8A020', teal2:'#C8841A',
          blue:'#3B82B8', gold:'#E8A020',
          red:'#D94040', green:'#2D9E6B',
          bg:'#F5F3EE', border:'#D6D1C8', muted:'#8B8D96'
        }
      },
      fontFamily: {
        sans:    ['"Space Grotesk"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
        display: ['Syne', 'sans-serif'],
      }
    }
  },
  plugins: []
}
export default config
