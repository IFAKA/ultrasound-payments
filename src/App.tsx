import { useState } from 'react'
import PaymentInterface from './components/PaymentInterface'
import ChatInterface from './components/ChatInterface'
import TextInterface from './components/TextInterface'
import AppSidebar from './components/AppSidebar'
import MobileHeader from './components/MobileHeader'
import { ProfileType } from './types'
import { 
  SidebarProvider, 
  SidebarInset 
} from '@/components/ui/sidebar'
import { useIsMobile } from '@/hooks/use-mobile'

type TabType = 'payment' | 'chat' | 'text'

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('payment')
  const [profile, setProfile] = useState<ProfileType>('ultrasonic')
  const isMobile = useIsMobile()

  return (
    <SidebarProvider>
      <AppSidebar 
        activeTab={activeTab}
        onTabChange={setActiveTab}
        profile={profile}
        onProfileChange={setProfile}
        isMobile={isMobile}
      />
      <SidebarInset>
        {/* Mobile Header */}
        {isMobile && <MobileHeader activeTab={activeTab} />}
        
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-4">
            {activeTab === 'payment' && <PaymentInterface profile={profile} onProfileChange={setProfile} />}
            {activeTab === 'chat' && <ChatInterface profile={profile} onProfileChange={setProfile} />}
            {activeTab === 'text' && <TextInterface profile={profile} onProfileChange={setProfile} />}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App