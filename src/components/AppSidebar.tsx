import { ProfileType } from '../types'
import ProfileSelector from './ProfileSelector'
import { 
  Sidebar, 
  SidebarContent, 
  SidebarFooter, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarGroupLabel, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem, 
  SidebarProvider, 
  SidebarTrigger,
  useSidebar 
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { 
  CreditCard, 
  MessageSquare, 
  FileText, 
  Github 
} from 'lucide-react'

type TabType = 'payment' | 'chat' | 'text'

interface AppSidebarProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  profile: ProfileType
  onProfileChange: (profile: ProfileType) => void
  isMobile: boolean
}

const AppSidebarContent = ({ activeTab, onTabChange, profile, onProfileChange, isMobile }: AppSidebarProps) => {
  const { setOpenMobile } = useSidebar()
  
  const menuItems = [
    {
      id: 'payment' as TabType,
      label: 'Payment System',
      icon: CreditCard,
      emoji: '💳'
    },
    {
      id: 'chat' as TabType,
      label: 'Audio Chat',
      icon: MessageSquare,
      emoji: '💬'
    },
    {
      id: 'text' as TabType,
      label: 'Text Transfer',
      icon: FileText,
      emoji: '📝'
    }
  ]

  const handleTabChange = (tab: TabType) => {
    onTabChange(tab)
    // Close mobile sidebar when a tab is selected
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <Sidebar variant="inset" className="border-r border-border">
      <SidebarHeader className="border-b border-border p-4">
        <div className="text-center">
          <h1 className="text-xl font-bold leading-tight">Ultrasound Demo</h1>
          <p className="text-sm text-muted-foreground leading-snug">
            Experience data transmission through sound waves
          </p>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-4">
        {/* Profile Selector - Desktop */}
        {!isMobile && (
          <div className="mb-4">
            <ProfileSelector 
              profile={profile} 
              onProfileChange={onProfileChange}
            />
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    asChild
                    isActive={activeTab === item.id}
                  >
                    <Button
                      variant={activeTab === item.id ? "default" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => handleTabChange(item.id)}
                    >
                      <span className="mr-2">{item.emoji}</span>
                      {item.label}
                    </Button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-4">
        <div className="text-center">
          <Button variant="ghost" size="sm" asChild>
            <a 
              href="https://github.com/IFAKA/ultrasound-payments" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <Github className="h-4 w-4" />
              View on GitHub
            </a>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebarContent
