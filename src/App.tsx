import { useState, useEffect } from 'react'
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
    <div className="min-h-screen h-screen h-dvh flex flex-row w-full box-border relative">
      {/* Sidebar */}
      <aside 
        className={`bg-gray-900 border-r border-gray-700 transition-all duration-300 ease-in-out overflow-y-auto flex-shrink-0 ${
          sidebarOpen 
            ? 'w-80' 
            : isMobile 
              ? 'w-0 overflow-hidden fixed top-0 left-0 h-screen h-dvh z-[1001] transform -translate-x-full' 
              : 'w-0 overflow-hidden'
        }`}
        style={sidebarOpen && !isMobile ? { width: '320px' } : {}}
      >
        <div className="flex flex-col h-full p-4">
          {/* Desktop Header */}
          {!isMobile && (
            <div className="text-center mb-4 pb-4 border-b border-gray-700">
              <h1 className="m-0 mb-2 text-xl font-bold text-white leading-tight">Ultrasound Demo</h1>
              <p className="m-0 text-gray-400 text-sm leading-snug">Experience data transmission through sound waves</p>
            </div>
          )}

          {/* Profile Selector - Desktop */}
          {!isMobile && (
            <div className="mb-4">
              <ProfileSelector 
                profile={profile} 
                onProfileChange={setProfile}
              />
            </div>
          )}

          {/* Navigation */}
          <nav className="flex flex-col gap-2 mb-8">
            <button 
              className={`bg-transparent border border-gray-700 text-gray-400 px-4 py-3 rounded-lg cursor-pointer text-sm font-semibold transition-all duration-200 ease-in-out flex items-center gap-2 text-left w-full hover:border-blue-400 hover:text-blue-400 hover:bg-blue-400/10 ${
                activeTab === 'payment' 
                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/30' 
                  : ''
              }`}
              onClick={() => {
                setActiveTab('payment')
                if (isMobile) setSidebarOpen(false)
              }}
            >
              💳 Payment System
            </button>
            <button 
              className={`bg-transparent border border-gray-700 text-gray-400 px-4 py-3 rounded-lg cursor-pointer text-sm font-semibold transition-all duration-200 ease-in-out flex items-center gap-2 text-left w-full hover:border-blue-400 hover:text-blue-400 hover:bg-blue-400/10 ${
                activeTab === 'chat' 
                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/30' 
                  : ''
              }`}
              onClick={() => {
                setActiveTab('chat')
                if (isMobile) setSidebarOpen(false)
              }}
            >
              💬 Audio Chat
            </button>
            <button 
              className={`bg-transparent border border-gray-700 text-gray-400 px-4 py-3 rounded-lg cursor-pointer text-sm font-semibold transition-all duration-200 ease-in-out flex items-center gap-2 text-left w-full hover:border-blue-400 hover:text-blue-400 hover:bg-blue-400/10 ${
                activeTab === 'text' 
                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/30' 
                  : ''
              }`}
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
            <div className="text-center pt-4 border-t border-gray-700 text-gray-400 text-xs">
              <p>
                <a href="https://github.com/IFAKA/ultrasound-payments" target="_blank" rel="noopener noreferrer" className="text-blue-400 no-underline hover:underline">
                  🔗 View on GitHub
                </a>
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header with Menu Button */}
        {isMobile && (
          <header className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700 flex-shrink-0 w-full box-border relative z-[1000]">
            <button 
              className="bg-transparent border border-gray-700 text-gray-100 p-2 rounded-md cursor-pointer text-xl flex items-center justify-center w-10 h-10 transition-all duration-200 ease-in-out hover:bg-blue-600 hover:border-blue-600 hover:text-white"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle menu"
            >
              ☰
            </button>
            <h1 className="m-0 text-lg font-semibold text-white text-center flex-1">
              {activeTab === 'payment' && '💳 Payment System'}
              {activeTab === 'chat' && '💬 Audio Chat'}
              {activeTab === 'text' && '📝 Text Transfer'}
            </h1>
            <div></div> {/* Spacer for centering */}
          </header>
        )}

        {/* Main Content */}
        <main className="flex-1 px-4 py-2 w-full box-border overflow-y-auto min-h-0">
          {activeTab === 'payment' && <PaymentInterface profile={profile} onProfileChange={setProfile} />}
          {activeTab === 'chat' && <ChatInterface profile={profile} onProfileChange={setProfile} />}
          {activeTab === 'text' && <TextInterface profile={profile} onProfileChange={setProfile} />}
        </main>

        {/* Mobile Footer */}
        {isMobile && (
          <footer className="text-center px-4 py-2 bg-gray-900 border-t border-gray-700 text-gray-400 text-xs flex-shrink-0 w-full box-border">
            <p>
              <a href="https://github.com/IFAKA/ultrasound-payments" target="_blank" rel="noopener noreferrer" className="text-blue-400 no-underline hover:underline">
                🔗 View on GitHub
              </a>
            </p>
          </footer>
        )}
      </div>

      {/* Overlay for mobile sidebar */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed top-0 left-0 w-full h-full bg-black/50 z-[1000] backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}

export default App