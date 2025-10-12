import { useState, useEffect } from 'react'
import './App.css'
import PaymentInterface from './components/PaymentInterface'
import ChatInterface from './components/ChatInterface'
import TextInterface from './components/TextInterface'
import ProfileSelector from './components/ProfileSelector'
import { ProfileType } from './types'

type TabType = 'payment' | 'chat' | 'text'

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('payment')
  const [profile, setProfile] = useState<ProfileType>('ultrasonic')
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true)
  const [isMobile, setIsMobile] = useState<boolean>(false)

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
      if (window.innerWidth <= 768) {
        setSidebarOpen(false) // Hide sidebar on mobile by default
      } else {
        setSidebarOpen(true) // Show sidebar on desktop by default
      }
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-content">
          {/* Desktop Header */}
          {!isMobile && (
            <div className="sidebar-header">
              <h1>Ultrasound Demo</h1>
              <p>Experience data transmission through sound waves</p>
            </div>
          )}

          {/* Profile Selector - Desktop */}
          {!isMobile && (
            <div className="sidebar-profile">
              <ProfileSelector 
                profile={profile} 
                onProfileChange={setProfile}
              />
            </div>
          )}

          {/* Navigation */}
          <nav className="sidebar-nav">
            <button 
              className={`nav-button ${activeTab === 'payment' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('payment')
                if (isMobile) setSidebarOpen(false)
              }}
            >
              💳 Payment System
            </button>
            <button 
              className={`nav-button ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('chat')
                if (isMobile) setSidebarOpen(false)
              }}
            >
              💬 Audio Chat
            </button>
            <button 
              className={`nav-button ${activeTab === 'text' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('text')
                if (isMobile) setSidebarOpen(false)
              }}
            >
              📝 Text Transfer
            </button>
          </nav>


          {/* Desktop Footer */}
          {!isMobile && (
            <div className="sidebar-footer">
              <p>
                Built with <a href="https://github.com/quiet/quiet-js" target="_blank" rel="noopener noreferrer">Quiet.js</a>
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="main-wrapper">
        {/* Mobile Header with Menu Button */}
        {isMobile && (
          <header className="mobile-header">
            <button 
              className="menu-button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle menu"
            >
              ☰
            </button>
            <h1>
              {activeTab === 'payment' && '💳 Payment System'}
              {activeTab === 'chat' && '💬 Audio Chat'}
              {activeTab === 'text' && '📝 Text Transfer'}
            </h1>
            <div></div> {/* Spacer for centering */}
          </header>
        )}

        {/* Main Content */}
        <main className="app-main">
          {activeTab === 'payment' && <PaymentInterface profile={profile} onProfileChange={setProfile} />}
          {activeTab === 'chat' && <ChatInterface profile={profile} onProfileChange={setProfile} />}
          {activeTab === 'text' && <TextInterface profile={profile} onProfileChange={setProfile} />}
        </main>

        {/* Mobile Footer */}
        {isMobile && (
          <footer className="mobile-footer">
            <p>
              Built with <a href="https://github.com/quiet/quiet-js" target="_blank" rel="noopener noreferrer">Quiet.js</a>
            </p>
          </footer>
        )}
      </div>

      {/* Overlay for mobile sidebar */}
      {isMobile && sidebarOpen && (
        <div 
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}

export default App