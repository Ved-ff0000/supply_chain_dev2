import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider } from './lib/auth'
import { NotificationProvider } from './lib/notifications'
import { ToastProvider } from './components/Toast'
import './styles/tailwind.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <AuthProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>
)
