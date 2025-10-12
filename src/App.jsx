import { useState } from 'react'
import './App.css'
import PaymentInterface from './components/PaymentInterface'
import ChatInterface from './components/ChatInterface'
import TextInterface from './components/TextInterface'

type TabType = 'payment' | 'chat' | 'text'

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('payment')

  return (
    <div className="app">
      <header className="app-header">
        <h1>🔊 Ultrasound Communication Demo</h1>
        <p>Experience data transmission through sound waves</p>
      </header>

      <nav className="tab-nav">
        <button 
          className={activeTab === 'payment' ? 'active' : ''}
          onClick={() => setActiveTab('payment')}
        >
          💳 Payment System
        </button>
        <button 
          className={activeTab === 'chat' ? 'active' : ''}
          onClick={() => setActiveTab('chat')}
        >
          💬 Audio Chat
        </button>
        <button 
          className={activeTab === 'text' ? 'active' : ''}
          onClick={() => setActiveTab('text')}
        >
          📝 Text Transfer
        </button>
      </nav>

      <main className="app-main">
        {activeTab === 'payment' && <PaymentInterface />}
        {activeTab === 'chat' && <ChatInterface />}
        {activeTab === 'text' && <TextInterface />}
      </main>

      <footer className="app-footer">
        <p>
          Built with <a href="https://github.com/quiet/quiet-js" target="_blank" rel="noopener noreferrer">Quiet.js</a> • 
          <a href="https://quiet.github.io/quiet-js/" target="_blank" rel="noopener noreferrer"> Live Demo</a>
        </p>
      </footer>
    </div>
  )
}

export default App