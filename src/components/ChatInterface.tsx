import { useState, useEffect, useRef } from 'react'
import './ChatInterface.css'
import { ProfileType, Message } from '../types'
import { initializeQuiet, isQuietReady } from '../utils/quietInit'
import { chatLogger, audioLogger } from '../utils/logger'
import ProfileSelector from './ProfileSelector'

interface ChatInterfaceProps {
  profile: ProfileType
  onProfileChange: (profile: ProfileType) => void
}

const ChatInterface = ({ profile, onProfileChange }: ChatInterfaceProps) => {
  const [isReady, setIsReady] = useState<boolean>(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState<string>('')
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false)
  const [isReceiving, setIsReceiving] = useState<boolean>(false)
  const [audioLevel, setAudioLevel] = useState<number>(0)
  const [detectedFreq, setDetectedFreq] = useState<string>('—')
  const [isMobile, setIsMobile] = useState<boolean>(false)
  const [sessionId] = useState<string>(() => Math.random().toString(36).slice(2, 10))

  const receiverRef = useRef<any>(null)
  const transmitterRef = useRef<any>(null)
  const messageBufRef = useRef<string>('')
  const recentMessagesRef = useRef<Map<string, number>>(new Map())
  const micVizRef = useRef<HTMLCanvasElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)


  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Initialize Quiet.js
  useEffect(() => {
    const initQuiet = async () => {
      try {
        await initializeQuiet()
        setIsReady(true)
      } catch (error) {
        chatLogger.error('Failed to initialize Quiet.js', error)
      }
    }

    initQuiet()
    initMicVisualizer()

    return () => {
      cleanup()
    }
  }, [])

  // Load script helper
  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = src
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  // Initialize microphone visualizer
  const initMicVisualizer = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      })

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      audioCtxRef.current = audioCtx

      const src = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = 0.85
      src.connect(analyser)
      analyserRef.current = analyser

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      dataArrayRef.current = dataArray

      const canvas = micVizRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1))
        
        const resize = () => {
          const cssW = canvas.clientWidth || 220
          const cssH = canvas.clientHeight || 20
          canvas.width = cssW * dpr
          canvas.height = cssH * dpr
        }
        resize()

        const draw = () => {
          if (!analyser || !dataArray) return
          
          analyser.getByteFrequencyData(dataArray)
          
          // Calculate audio level
          const avgLevel = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length
          setAudioLevel(Math.round((avgLevel / 255) * 100))

          // Detect frequency
          let maxIdx = 0, maxVal = -1
          for (let i = 0; i < dataArray.length; i++) {
            const v = dataArray[i]
            if (v > maxVal) {
              maxVal = v
              maxIdx = i
            }
          }

          if (audioCtx && maxVal > 8) {
            const binWidthHz = audioCtx.sampleRate / analyser.fftSize
            let peak = maxIdx
            if (maxIdx > 0 && maxIdx < dataArray.length - 1) {
              const alpha = dataArray[maxIdx - 1]
              const beta = dataArray[maxIdx]
              const gamma = dataArray[maxIdx + 1]
              const denom = (alpha - 2 * beta + gamma) || 1e-6
              const p = 0.5 * (alpha - gamma) / denom
              peak = maxIdx + (p < -1 ? -1 : (p > 1 ? 1 : p))
            }
            const freqHz = peak * binWidthHz
            const display = freqHz >= 1000 ? (freqHz / 1000).toFixed(1) + ' kHz' : Math.round(freqHz) + ' Hz'
            setDetectedFreq(display)
          } else {
            setDetectedFreq('—')
          }

          // Draw visualization
          const w = canvas.width, h = canvas.height
          ctx.clearRect(0, 0, w, h)
          
          const bars = Math.floor(w / (6 * dpr))
          const barW = Math.max(2 * dpr, Math.floor((w / bars) * 0.4))
          const gap = Math.max(2 * dpr, Math.floor((w / bars) * 0.6))
          const step = Math.floor(dataArray.length / bars) || 1
          const radius = Math.floor(Math.min(barW, h) * 0.22)
          
          ctx.fillStyle = '#ffffff'
          for (let i = 0; i < bars; i++) {
            let v = 0
            const start = i * step
            for (let j = 0; j < step; j++) {
              v += dataArray[start + j] || 0
            }
            v /= step
            const barH = Math.max(radius * 2, Math.round((v / 255) * (h - 2 * dpr)))
            const x = i * (barW + gap)
            const y = h - barH
            const r = Math.min(radius, barW / 2, barH / 2)
            
            ctx.beginPath()
            ctx.moveTo(x + r, y)
            ctx.lineTo(x + barW - r, y)
            ctx.quadraticCurveTo(x + barW, y, x + barW, y + r)
            ctx.lineTo(x + barW, y + barH - r)
            ctx.quadraticCurveTo(x + barW, y + barH, x + barW - r, y + barH)
            ctx.lineTo(x + r, y + barH)
            ctx.quadraticCurveTo(x, y + barH, x, y + barH - r)
            ctx.lineTo(x, y + r)
            ctx.quadraticCurveTo(x, y, x + r, y)
            ctx.closePath()
            ctx.fill()
          }

          rafIdRef.current = requestAnimationFrame(draw)
        }

        draw()
        window.addEventListener('resize', resize)
      }
    } catch (error) {
      audioLogger.error('Microphone visualizer unavailable', error)
    }
  }

  // Start receiver
  const startReceiver = () => {
    if (!isReady) return

    // Destroy existing receiver if it exists
    if (receiverRef.current) {
      receiverRef.current.destroy()
      receiverRef.current = null
    }

    try {
      setIsReceiving(true)
      
      receiverRef.current = window.Quiet.receiver({
        profile,
        onReceive: (payload) => {
          messageBufRef.current += window.Quiet.ab2str(payload)
          const lines = messageBufRef.current.split('\n')
          messageBufRef.current = lines.pop()
          
          lines.forEach(line => {
            const msg = line.trim()
            if (!msg) return
            
            if (seen(msg)) return
            chatLogger.rx(msg)
            
            // Add received message to chat
            setMessages(prev => [...prev, {
              id: Date.now() + Math.random(),
              text: msg,
              type: 'received',
              timestamp: new Date()
            }])
          })
        },
        onCreate: () => chatLogger.success('Receiver created successfully'),
        onCreateFail: (r) => {
          chatLogger.error('Receiver creation failed', r)
          setIsReceiving(false)
        },
        onReceiveFail: (e) => chatLogger.error('Receive error', e)
      })
    } catch (e) {
      chatLogger.error('Receiver error', e)
      setIsReceiving(false)
    }
  }

  // Send message
  const sendMessage = () => {
    if (!isReady || !newMessage.trim() || isTransmitting) return
    
    const message = newMessage.trim()
    setNewMessage('')
    setIsTransmitting(true)
    
    // Add sent message to chat
    setMessages(prev => [...prev, {
      id: Date.now() + Math.random(),
      text: message,
      type: 'sent',
      timestamp: new Date()
    }])
    
    try {
      if (transmitterRef.current) {
        transmitterRef.current.destroy()
      }
      
      const payload = window.Quiet.str2ab(message + '\n')
      transmitterRef.current = window.Quiet.transmitter({
        profile,
        onFinish: () => {
          chatLogger.success('Message transmission completed')
          setIsTransmitting(false)
        }
      })
      
      chatLogger.tx(message)
      transmitterRef.current.transmit(payload)
    } catch (e) {
      chatLogger.error('Message transmission error', e)
      setIsTransmitting(false)
    }
  }

  // Helper functions
  const seen = (msg) => {
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

  const cleanup = () => {
    if (receiverRef.current) {
      receiverRef.current.destroy()
      receiverRef.current = null
    }
    if (transmitterRef.current) {
      transmitterRef.current.destroy()
      transmitterRef.current = null
    }
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close()
      audioCtxRef.current = null
    }
  }

  // Start receiver when ready
  useEffect(() => {
    if (isReady) {
      startReceiver()
    }
  }, [isReady, profile])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])


  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="chat-interface">
      {!isMobile && (
        <div className="chat-header">
          <h2>💬 Ultrasound Audio Chat</h2>
        </div>
      )}

      {/* Profile Selector - Mobile */}
      {isMobile && (
        <div className="mobile-profile-selector">
          <ProfileSelector 
            profile={profile} 
            onProfileChange={onProfileChange}
          />
        </div>
      )}

      <div className="audio-monitor">
        <canvas 
          ref={micVizRef} 
          width="220" 
          height="20" 
          className="mic-visualizer"
          aria-label="microphone activity"
          title="Microphone activity"
        />
        <span className="freq-display">{detectedFreq}</span>
        <span className="audio-level">Audio: {audioLevel}%</span>
      </div>

      <div className="chat-container">
        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="empty-state">
              <p>No messages yet. Start typing to send your first ultrasound message!</p>
            </div>
          ) : (
            messages.map((message) => (
              <div 
                key={message.id} 
                className={`message ${message.type}`}
              >
                <div className="message-content">
                  {message.text}
                </div>
                <div className="message-time">
                  {formatTime(message.timestamp)}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-container">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyUp={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type your message..."
            disabled={!isReady || isTransmitting}
            maxLength={100}
          />
          <button 
            onClick={sendMessage}
            disabled={!isReady || !newMessage.trim() || isTransmitting}
            className="send-button"
          >
            {isTransmitting ? <div className="spinner"></div> : '📡'}
          </button>
        </div>
      </div>

      {!isReady && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="spinner"></div>
            <p>Initializing ultrasound communication...</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatInterface
