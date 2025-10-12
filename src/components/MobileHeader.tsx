import { ProfileType } from '../types'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { 
  CreditCard, 
  MessageSquare, 
  FileText 
} from 'lucide-react'

type TabType = 'payment' | 'chat' | 'text'

interface MobileHeaderProps {
  activeTab: TabType
}

const MobileHeader = ({ activeTab }: MobileHeaderProps) => {
  const getTabInfo = (tab: TabType) => {
    switch (tab) {
      case 'payment':
        return { emoji: '💳', label: 'Payment System', icon: CreditCard }
      case 'chat':
        return { emoji: '💬', label: 'Audio Chat', icon: MessageSquare }
      case 'text':
        return { emoji: '📝', label: 'Text Transfer', icon: FileText }
    }
  }

  const tabInfo = getTabInfo(activeTab)

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-background">
      <SidebarTrigger className="md:hidden" />
      <h1 className="text-lg font-semibold text-center flex-1 flex items-center justify-center gap-2">
        <span>{tabInfo.emoji}</span>
        {tabInfo.label}
      </h1>
      <div className="w-10" /> {/* Spacer for centering */}
    </header>
  )
}

export default MobileHeader
