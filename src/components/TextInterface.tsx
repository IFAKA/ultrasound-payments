import { useState, useEffect, useRef } from 'react'
import { ProfileType, TransmissionRecord } from '../types'
import { initializeQuiet } from '../utils/quietInit'
import { textLogger, audioLogger } from '../utils/logger'
import ProfileSelector from './ProfileSelector'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface TextInterfaceProps {
  profile: ProfileType
  onProfileChange: (profile: ProfileType) => void
}

const TextInterface = ({ profile, onProfileChange }: TextInterfaceProps) => {
  const [isReady, setIsReady] = useState<boolean>(false)
  const [textToSend, setTextToSend] = useState<string>('')
  const [receivedText, setReceivedText] = useState<string>('')
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false)
  const [transmissionHistory, setTransmissionHistory] = useState<TransmissionRecord[]>([])
  const [audioLevel, setAudioLevel] = useState<number>(0)
  const [detectedFreq, setDetectedFreq] = useState<string>('—')
  const [isMobile, setIsMobile] = useState<boolean>(false)

  const receiverRef = useRef<any>(null)
  const transmitterRef = useRef<any>(null)
  const textBufRef = useRef<string>('')
  const recentMessagesRef = useRef<Map<string, number>>(new Map())
  const micVizRef = useRef<HTMLCanvasElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)
  const rafIdRef = useRef<number | null>(null)


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
        textLogger.error('Failed to initialize Quiet.js', error)
      }
    }

    initQuiet()
    initMicVisualizer()

    return () => {
      cleanup()
    }
  }, [])


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
        if (!ctx) return
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
      receiverRef.current = window.Quiet.receiver({
        profile,
        onReceive: (payload: ArrayBuffer) => {
          textBufRef.current += window.Quiet.ab2str(payload)
          const lines = textBufRef.current.split('\n')
          textBufRef.current = lines.pop() || ''
          
          lines.forEach(line => {
            const text = line.trim()
            if (!text) return
            
            if (seen(text)) return
            textLogger.rx(text)
            
            setReceivedText(text)
            
            // Add to transmission history
            setTransmissionHistory(prev => [...prev, {
              id: (Date.now() + Math.random()).toString(),
              text,
              timestamp: Date.now(),
              direction: 'received' as const
            }])
          })
        },
        onCreate: () => textLogger.success('Receiver created successfully'),
        onCreateFail: (r: any) => {
          textLogger.error('Receiver creation failed', r)
        },
        onReceiveFail: (e: any) => textLogger.error('Receive error', e)
      })
    } catch (e) {
      textLogger.error('Receiver error', e)
    }
  }

  // Send text
  const sendText = () => {
    if (!isReady || !textToSend.trim() || isTransmitting) return
    
    const text = textToSend.trim()
    setIsTransmitting(true)
    
    // Add to transmission history
    setTransmissionHistory(prev => [...prev, {
      id: (Date.now() + Math.random()).toString(),
      text,
      timestamp: Date.now(),
      direction: 'sent' as const
    }])
    
    try {
      if (transmitterRef.current) {
        transmitterRef.current.destroy()
      }
      
      const payload = window.Quiet.str2ab(text + '\n')
      transmitterRef.current = window.Quiet.transmitter({
        profile,
        onFinish: () => {
          textLogger.success('Text transmission completed')
          setIsTransmitting(false)
        }
      })
      
      textLogger.tx(text)
      transmitterRef.current.transmit(payload)
    } catch (e) {
      textLogger.error('Text transmission error', e)
      setIsTransmitting(false)
    }
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


  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const clearHistory = () => {
    setTransmissionHistory([])
    setReceivedText('')
  }

  return (
    <div className="h-full flex flex-col">
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

      <Card className="mb-4">
        <CardContent className="p-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <canvas 
              ref={micVizRef} 
              width="220" 
              height="20" 
              className="w-[150px] h-5 bg-transparent rounded"
              aria-label="microphone activity"
              title="Microphone activity"
            />
            <Badge variant="secondary" className="font-mono text-xs min-w-[80px] text-center">
              {detectedFreq}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Audio: {audioLevel}%
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Send Section */}
          <Card className="border-l-4 border-l-blue-400">
            <CardHeader>
              <CardTitle className="text-lg">📤 Send Text</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <Textarea
                  value={textToSend}
                  onChange={(e) => setTextToSend(e.target.value)}
                  placeholder="Enter text to transmit via ultrasound..."
                  disabled={!isReady || isTransmitting}
                  maxLength={500}
                  rows={4}
                  className="min-h-[100px] resize-y"
                />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{textToSend.length}/500</span>
                  <Button 
                    onClick={sendText}
                    disabled={!isReady || !textToSend.trim() || isTransmitting}
                    className="flex items-center gap-2"
                  >
                    {isTransmitting ? <div className="spinner w-3.5 h-3.5 border-2"></div> : '📡 Send'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Receive Section */}
          <Card className="border-l-4 border-l-green-400">
            <CardHeader>
              <CardTitle className="text-lg">📥 Received Text</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="min-h-[120px] bg-muted rounded-lg p-4 flex items-center justify-center">
                {receivedText ? (
                  <div className="text-sm leading-relaxed break-words w-full">
                    {receivedText}
                  </div>
                ) : (
                  <div className="text-muted-foreground text-sm text-center italic">
                    No text received yet. Start transmitting to see received text here.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* History Section */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">📋 Transmission History</CardTitle>
              <Button onClick={clearHistory} variant="outline" size="sm">
                🗑️ Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-72 overflow-y-auto flex flex-col gap-3">
              {transmissionHistory.length === 0 ? (
                <div className="text-muted-foreground text-sm text-center italic">
                  No transmissions yet. Send or receive text to see history here.
                </div>
              ) : (
                transmissionHistory.map((item) => (
                  <Card key={item.id} className={`animate-history-slide ${
                    item.direction === 'sent' ? 'border-l-4 border-l-blue-400' : 'border-l-4 border-l-green-400'
                  }`}>
                    <CardContent className="p-4">
                      <div className="text-sm leading-relaxed mb-2 break-words">
                        {item.text}
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span className="font-semibold">
                          {item.direction === 'sent' ? '📤 Sent' : '📥 Received'}
                        </span>
                        <span className="font-mono">
                          {formatTime(item.timestamp)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {!isReady && (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/80 flex items-center justify-center z-[1000]">
          <Card className="p-8 text-center">
            <CardContent className="flex flex-col gap-4 items-center">
              <div className="spinner w-8 h-8"></div>
              <p className="m-0 text-base">Initializing ultrasound communication...</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default TextInterface
