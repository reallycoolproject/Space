import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Auto-upgrade tunnel HTTP to HTTPS so Web Crypto (crypto.subtle) and Media devices are enabled
if (typeof window !== 'undefined' && window.location.protocol === 'http:' && window.location.hostname.endsWith('trycloudflare.com')) {
  window.location.replace(`https://${window.location.host}${window.location.pathname}${window.location.search}${window.location.hash}`)
}

// Initialize theme before rendering to prevent flash
const storedTheme = localStorage.getItem('theme')
const migrateTechDefault = storedTheme === 'signal'
const savedTheme = migrateTechDefault || !storedTheme ? 'frutiger-metro' : storedTheme
localStorage.setItem('theme', savedTheme)
localStorage.setItem('themeVersion', '3')
document.documentElement.setAttribute('data-theme', savedTheme)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
