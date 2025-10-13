import { useState, useEffect, useRef } from 'react'
import { ProfileType, Message } from '../types'
import { chatLogger } from '../utils/logger'
import { useUltrasound } from '../hooks/use-ultrasound'
import ProfileSelector from './ProfileSelector'
import AudioVisualizer from './AudioVisualizer'
import LoadingOverlay from './LoadingOverlay'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle, AlertCircle, Clock, RotateCcw } from 'lucide-react'

interface ChatInterfaceProps {
  profile: ProfileType
  onProfileChange: (profile: ProfileType) => void
}

const ChatInterface = ({ profile, onProfileChange }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState<string>('')
  const messageBufRef = useRef<string>('')
  const recentMessagesRef = useRef<Map<string, number>>(new Map())
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const {
    isReady,
    isTransmitting,
    audioLevel,
    detectedFreq,
    isMobile,
    micVizRef,
    startReceiver,
    sendData,
  } = useUltrasound({ profile, logger: chatLogger })

  // Handle received messages
  const handleReceive = (text: string) => {
    if (!text || seen(text)) return

    messageBufRef.current += text
    const lines = messageBufRef.current.split('\n')
    messageBufRef.current = lines.pop() || ''

    for (const line of lines) {
      if (line.trim()) {
        // Check if this is a delivery confirmation
        if (line.startsWith('DELIVERY_CONFIRM:')) {
          const messageId = line.replace('DELIVERY_CONFIRM:', '')
          setMessages(prev => prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, status: 'delivered' }
              : msg
          ))
          return
        }

        // Regular message
        const newMessage: Message = {
          id: (Date.now() + Math.random()).toString(),
          text: line.trim(),
          type: 'received',
          timestamp: Date.now(),
          sender: 'received',
          status: 'delivered'
        }
        
        setMessages(prev => [...prev, newMessage])
        
        // Send delivery confirmation
        sendData(`DELIVERY_CONFIRM:${newMessage.id}`)
      }
    }
  }

  // Send message
  const sendMessage = () => {
    if (!newMessage.trim()) return
    
    const message = newMessage.trim()
    const messageId = (Date.now() + Math.random()).toString()
    setNewMessage('')
    
    // Add sent message to chat with sending status
    const newMessageObj: Message = {
      id: messageId,
      text: message,
      type: 'sent',
      timestamp: Date.now(),
      sender: 'user',
      status: 'sending',
      retryCount: 0
    }
    
    setMessages(prev => [...prev, newMessageObj])
    
    // Send message with retry logic
    sendMessageWithRetry(messageId, message, 0)
  }

  // Send message with retry logic
  const sendMessageWithRetry = (messageId: string, message: string, retryCount: number) => {
    const success = sendData(message, () => {
      // Update status to sent
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, status: 'sent' }
          : msg
      ))
    })

    if (!success) {
      // Mark as failed and allow retry
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, status: 'failed', retryCount }
          : msg
      ))
    }
  }

  // Retry failed message
  const retryMessage = (messageId: string) => {
    const message = messages.find(msg => msg.id === messageId)
    if (!message) return

    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, status: 'sending', retryCount: (msg.retryCount || 0) + 1 }
        : msg
    ))

    sendMessageWithRetry(messageId, message.text, (message.retryCount || 0) + 1)
  }

  // Helper functions
  const seen = (msg: string) => {
    const now = Date.now()
    const time = recentMessagesRef.current.get(msg)
    if (time && now - time < 600) return true
    recentMessagesRef.current.set(msg, now)
    if (recentMessagesRef.current.size > 200) {
      const cutoff = now - 600
      for (const [k, v] of recentMessagesRef.current) {
        if (v < cutoff) recentMessagesRef.current.delete(k)
      }
    }
    return false
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Get status icon for message
  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'sending':
        return <Clock className="w-3 h-3 text-yellow-500" />
      case 'sent':
        return <CheckCircle className="w-3 h-3 text-blue-500" />
      case 'delivered':
        return <CheckCircle className="w-3 h-3 text-green-500" />
      case 'failed':
        return <AlertCircle className="w-3 h-3 text-red-500" />
      default:
        return null
    }
  }

  // Start receiver when ready
  useEffect(() => {
    if (isReady) {
      startReceiver(handleReceive)
    }
  }, [isReady, profile])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex flex-col">
      {/* Profile Selector - Mobile */}
      {isMobile && (
        <div className="mb-3 flex justify-center w-full">
          <div className="w-full">
            <ProfileSelector 
              profile={profile} 
              onProfileChange={onProfileChange}
            />
          </div>
        </div>
      )}

      <AudioVisualizer 
        micVizRef={micVizRef}
        audioLevel={audioLevel}
        detectedFreq={detectedFreq}
      />

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 max-h-96">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center text-muted-foreground">
              <p className="m-0 text-base">No messages yet. Start typing to send your first ultrasound message!</p>
            </div>
          ) : (
            messages.map((message) => (
              <div 
                key={message.id} 
                className={`flex flex-col max-w-[80%] animate-message-slide ${
                  message.type === 'sent' ? 'self-end' : 'self-start'
                }`}
              >
                <div className={`px-4 py-3 rounded-xl text-sm leading-relaxed break-words ${
                  message.type === 'sent' 
                    ? 'bg-primary text-primary-foreground rounded-br-md' 
                    : 'bg-muted text-muted-foreground rounded-bl-md'
                }`}>
                  {message.text}
                </div>
                <div className={`flex items-center gap-1 mt-1 px-2 ${
                  message.type === 'sent' ? 'justify-end' : 'justify-start'
                }`}>
                  <div className="text-xs text-muted-foreground">
                    {formatTime(message.timestamp)}
                  </div>
                  {message.type === 'sent' && (
                    <div className="flex items-center gap-1">
                      {getStatusIcon(message.status)}
                      {message.status === 'failed' && (
                        <Button
                          onClick={() => retryMessage(message.id)}
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 hover:bg-red-100"
                        >
                          <RotateCcw className="w-3 h-3 text-red-500" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        <div className="flex p-4 gap-3 border-t">
          <Input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyUp={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type your message..."
            disabled={!isReady || isTransmitting}
            maxLength={100}
            className="flex-1"
          />
          <Button 
            onClick={sendMessage}
            disabled={!isReady || !newMessage.trim() || isTransmitting}
            className="min-w-[50px]"
          >
            {isTransmitting ? <div className="spinner w-4 h-4 border-2"></div> : '📡'}
          </Button>
        </div>
      </Card>

      <LoadingOverlay isVisible={!isReady} />
    </div>
  )
}

export default ChatInterface