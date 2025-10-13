import { SidebarTrigger } from '@/components/ui/sidebar'
import { 
  CreditCard, 
  MessageSquare, 
  FileText,
  FolderOpen
} from 'lucide-react'

type TabType = 'payment' | 'chat' | 'text' | 'file'

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
      case 'file':
        return { emoji: '📁', label: 'File Transfer', icon: FolderOpen }
    }
  }

  const tabInfo = getTabInfo(activeTab)

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-background">
      <SidebarTrigger className="lg:hidden" />
      <h1 className="text-lg font-semibold text-center flex-1 flex items-center justify-center gap-2">
        <span>{tabInfo.emoji}</span>
        {tabInfo.label}
      </h1>
      <div className="w-10" /> {/* Spacer for centering */}
    </header>
  )
}

export default MobileHeader
