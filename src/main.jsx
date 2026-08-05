import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { inject } from '@vercel/analytics'
import './index.css'
import App from './App.jsx'
import { ThemeSwitcher } from './components/ThemeSwitcher.jsx'

inject()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <ThemeSwitcher />
  </StrictMode>,
)

// Service Worker — tylko w produkcji, żeby nie kolidował z Vite dev serverem
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function (err) {
      console.error('Service Worker registration failed:', err)
    })
  })
}
