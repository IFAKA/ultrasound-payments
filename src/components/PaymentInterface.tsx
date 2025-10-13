import { useState, useEffect, useRef } from 'react'
import { ProfileType, StateType, PaymentRequest } from '../types'
import { initializeQuiet } from '../utils/quietInit'
import { paymentLogger, audioLogger, seenLogger } from '../utils/logger'
import ProfileSelector from './ProfileSelector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'

interface PaymentInterfaceProps {
  profile: ProfileType
  onProfileChange: (profile: ProfileType) => void
}

const PaymentInterface = ({ profile, onProfileChange }: PaymentInterfaceProps) => {
  const [isReady, setIsReady] = useState<boolean>(false)
  const [merchantEnabled, setMerchantEnabled] = useState<boolean>(true)
  const [customerEnabled, setCustomerEnabled] = useState<boolean>(true)
  const [merchantAmount, setMerchantAmount] = useState<string>('')
  const [customerPin, setCustomerPin] = useState<string>('')
  const [, setMerchantState] = useState<StateType>('idle')
  const [, setCustomerState] = useState<StateType>('idle')
  const [merchantStatus, setMerchantStatus] = useState<string>('Ready to process payment')
  const [customerStatus, setCustomerStatus] = useState<string>('Ready to pay')
  const [merchantValue, setMerchantValue] = useState<string>('')
  const [customerValue, setCustomerValue] = useState<string>('')
  const [showMerchantSuccess, setShowMerchantSuccess] = useState<boolean>(false)
  const [showCustomerSuccess, setShowCustomerSuccess] = useState<boolean>(false)
  const [showMerchantLoading, setShowMerchantLoading] = useState<boolean>(false)
  const [showCustomerLoading, setShowCustomerLoading] = useState<boolean>(false)
  const [showCustomerInput, setShowCustomerInput] = useState<boolean>(false)
  const [sessionId] = useState<string>(() => Math.random().toString(36).slice(2, 10))
  const [merchantId] = useState<string>(() => 'M-' + sessionId)
  const [customerId] = useState<string>(() => 'C-' + sessionId)
  const [currentNonce, setCurrentNonce] = useState<string | null>(null)
  const [, setLastPayReq] = useState<PaymentRequest | null>(null)
  const [audioLevel, setAudioLevel] = useState<number>(0)
  const [detectedFreq, setDetectedFreq] = useState<string>('—')
  const [fps, setFps] = useState<string>('—')
  const [isMobile, setIsMobile] = useState<boolean>(false)
  const [merchantTransmitting, setMerchantTransmitting] = useState<boolean>(false)
  const [customerTransmitting, setCustomerTransmitting] = useState<boolean>(false)
  const [, setMerchantTransmitComplete] = useState<boolean>(false)
  const [, setCustomerTransmitComplete] = useState<boolean>(false)
  const [showMerchantRetry, setShowMerchantRetry] = useState<boolean>(false)
  const [showCustomerRetry, setShowCustomerRetry] = useState<boolean>(false)
  const [waitingForConfirmation, setWaitingForConfirmation] = useState<boolean>(false)
  const [waitingForAuthorization, setWaitingForAuthorization] = useState<boolean>(false)
  
  // Frequency averaging buffer
  const freqBufferRef = useRef<Array<{freq: number, timestamp: number}>>([])
  const lastFreqUpdateRef = useRef<number>(0)
  const currentDisplayFreqRef = useRef<string>('—')

  const merchantReceiverRef = useRef<any>(null)
  const merchantTransmitterRef = useRef<any>(null)
  const customerReceiverRef = useRef<any>(null)
  const customerTransmitterRef = useRef<any>(null)
  const merchantBufRef = useRef<string>('')
  const customerBufRef = useRef<string>('')
  const recentMessagesRef = useRef<Map<string, number>>(new Map())
  const micVizRef = useRef<HTMLCanvasElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const customerPinInputRef = useRef<HTMLInputElement | null>(null)
  
  // Use refs for immediate state tracking (like the working example)
  const merchantStateRef = useRef<StateType>('idle')
  const customerStateRef = useRef<StateType>('idle')
  const lastPayReqRef = useRef<PaymentRequest | null>(null)
  const currentNonceRef = useRef<string | null>(null)


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
        paymentLogger.system.error('Failed to initialize Quiet.js', error)
        setMerchantStatus('Failed to load Quiet.js')
        setCustomerStatus('Failed to load Quiet.js')
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
            
            // Add to frequency buffer for averaging
            const now = performance.now()
            freqBufferRef.current.push({ freq: freqHz, timestamp: now })
            
            // Remove old entries (older than 1 second)
            const oneSecondAgo = now - 1000
            freqBufferRef.current = freqBufferRef.current.filter(entry => entry.timestamp > oneSecondAgo)
            
            // Only update display every 500ms to reduce flickering
            if (now - lastFreqUpdateRef.current > 500) {
              if (freqBufferRef.current.length > 0) {
                // Calculate weighted average (more recent readings have higher weight)
                let weightedSum = 0
                let totalWeight = 0
                const maxAge = 1000 // 1 second
                
                freqBufferRef.current.forEach(entry => {
                  const age = now - entry.timestamp
                  const weight = Math.max(0, 1 - (age / maxAge)) // Linear weight decay
                  weightedSum += entry.freq * weight
                  totalWeight += weight
                })
                
                if (totalWeight > 0) {
                  const avgFreq = weightedSum / totalWeight
                  const display = avgFreq >= 1000 ? (avgFreq / 1000).toFixed(1) + ' kHz' : Math.round(avgFreq) + ' Hz'
                  
                  // Only update if the display value has changed significantly
                  if (display !== currentDisplayFreqRef.current) {
                    setDetectedFreq(display)
                    currentDisplayFreqRef.current = display
                  }
                }
              } else {
                if (currentDisplayFreqRef.current !== '—') {
                  setDetectedFreq('—')
                  currentDisplayFreqRef.current = '—'
                }
              }
              lastFreqUpdateRef.current = now
            }
          } else {
            // Clear buffer when no signal detected
            freqBufferRef.current = []
            // Only update display every 500ms to reduce flickering
            const now = performance.now()
            if (now - lastFreqUpdateRef.current > 500) {
              if (currentDisplayFreqRef.current !== '—') {
                setDetectedFreq('—')
                currentDisplayFreqRef.current = '—'
              }
              lastFreqUpdateRef.current = now
            }
          }

          // Draw visualization
          const w = canvas.width, h = canvas.height
          if (ctx) {
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

  // FPS counter
  useEffect(() => {
    let lastTs = performance.now()
    let frames = 0

    const tick = (now: number) => {
      frames++
      const elapsed = now - lastTs
      if (elapsed >= 1000) {
        const fpsValue = Math.round(frames * 1000 / elapsed)
        setFps(fpsValue.toString() + ' fps')
        frames = 0
        lastTs = now
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [])

  // Start merchant receiver
  const startMerchantRx = () => {
    if (!isReady) return

    // Destroy existing receiver if it exists
    if (merchantReceiverRef.current) {
      merchantReceiverRef.current.destroy()
      merchantReceiverRef.current = null
    }

    try {
      setMerchantStatus('Listening for payment confirmation on ' + profile + '...')
      
      merchantReceiverRef.current = window.Quiet.receiver({
        profile,
        onReceive: (payload: any) => {
          merchantBufRef.current += window.Quiet.ab2str(payload) || ''
          const lines = merchantBufRef.current.split('\n')
          merchantBufRef.current = lines.pop() || ''
          
          lines.forEach(line => {
            const msg = line.trim()
            if (!msg) return
            
            if (seen('M:' + msg)) return
            paymentLogger.merchant.rx(msg)
            
            const own = /:([A-Za-z0-9_-]{6,})$/.exec(msg)
            if (own && own[1] === merchantId) return
            
            const m = /^ACK:([A-Za-z0-9_-]+):([A-Fa-f0-9]{8,64}):([A-Za-z0-9_-]+)$/.exec(msg)
            if (m) {
              const nonce = m[1]
              const tokenHash = m[2]
              const senderId = m[3]
              
              paymentLogger.merchant.rx(`ACK received`, { nonce, tokenHash, senderId })
              paymentLogger.merchant.state('ACK validation', { 
                merchantState: merchantStateRef.current, 
                lastPayReq: lastPayReqRef.current ? { nonce: lastPayReqRef.current.nonce, amount: lastPayReqRef.current.amount } : null,
                nonceMatch: lastPayReqRef.current && lastPayReqRef.current.nonce === nonce
              })
              
              if (merchantStateRef.current !== 'awaiting_payack') {
                paymentLogger.merchant.warning(`ACK ignored - wrong state: ${merchantStateRef.current}`)
                return
              }
              if (!lastPayReqRef.current || !lastPayReqRef.current.nonce || nonce !== lastPayReqRef.current.nonce) {
                paymentLogger.merchant.warning('ACK ignored - nonce mismatch')
                setMerchantStatus('ACK nonce mismatch. Ignoring.')
                return
              }
              
              setMerchantState('authorized')
              setMerchantStatus('Payment authorized. ACK received.')
              setShowMerchantLoading(false)
              setShowMerchantSuccess(true)
              setMerchantValue(lastPayReqRef.current.amount + ' ' + (lastPayReqRef.current.currency || 'USD'))
              setShowMerchantRetry(false)
              setWaitingForAuthorization(false)
              
              // Auto-reset after 3 seconds
              setTimeout(() => {
                resetPaymentSystem()
              }, 3000)
              
              // Send confirmation
              try {
                const fin = 'FIN:' + nonce + ':' + merchantId + '\n'
                paymentLogger.merchant.tx(`FIN prepare: ${fin.trim()}`)
                const tx = window.Quiet.transmitter({
                  profile,
                  onFinish: () => paymentLogger.merchant.success('FIN transmission completed'),
                  onCreateFail: (error: any) => {
                    paymentLogger.merchant.error('FIN transmitter creation failed', error)
                  }
                })
                tx.transmit(window.Quiet.str2ab(fin))
                setMerchantStatus('Payment authorized. Confirmation sent.')
                paymentLogger.merchant.success('FIN sent successfully')
              } catch (e: any) {
                paymentLogger.merchant.error('FIN transmission error', e)
              }
            }
          })
        },
        onCreate: () => paymentLogger.merchant.success('Receiver created successfully'),
        onCreateFail: (r: any) => {
          paymentLogger.merchant.error('Receiver creation failed', r)
          setMerchantStatus('Receiver failed: ' + r + '. Try a different profile.')
          // Don't crash the app, just show error
        },
        onReceiveFail: (e: any) => paymentLogger.merchant.error('Receive error', e)
      })
    } catch (e: any) {
      setMerchantStatus('Receiver error: ' + e.message)
    }
  }

  // Start customer receiver
  const startCustomerRx = () => {
    paymentLogger.customer.state('Starting customer receiver', { isReady, hasReceiver: !!customerReceiverRef.current })
    if (!isReady) return

    // Destroy existing receiver if it exists
    if (customerReceiverRef.current) {
      customerReceiverRef.current.destroy()
      customerReceiverRef.current = null
    }

    try {
      setCustomerStatus('Listening for payment request on ' + profile + '...')
      
      customerReceiverRef.current = window.Quiet.receiver({
        profile,
        onReceive: (payload: any) => {
          const receivedData = window.Quiet.ab2str(payload) || ''
          paymentLogger.customer.debug('Raw data received', receivedData)
          customerBufRef.current += receivedData
          const lines = customerBufRef.current.split('\n')
          customerBufRef.current = lines.pop() || ''
          
          paymentLogger.customer.debug('Processing lines', lines)
          lines.forEach(line => {
            const msg = line.trim()
            if (!msg) return
            
            if (seen('C:' + msg)) return
            paymentLogger.customer.rx(msg)
            
            const own = /:([A-Za-z0-9_-]{6,})$/.exec(msg)
            if (own && own[1] === customerId) return
            
            const m = /^PRQ:([0-9]+(?:\.[0-9]+)?):([A-Za-z]{1,3}):([A-Za-z0-9_-]+):([A-Za-z0-9_-]+)$/.exec(msg)
            if (m) {
              const amount = m[1]
              const currency = m[2]
              const nonce = m[3]
              const senderId = m[4]
              
              paymentLogger.customer.rx(`Payment request received`, { amount, currency, nonce, senderId })
              
              if (!customerEnabled) return
              if (customerStateRef.current !== 'idle') return
              
              setCurrentNonce(nonce)
              setCustomerState('received_payreq')
              currentNonceRef.current = nonce
              customerStateRef.current = 'received_payreq'
              setCustomerStatus('Payment request: ' + amount + ' ' + currency + '. Ready to authorize.')
              setShowCustomerInput(true)
              setCustomerValue(amount + ' ' + currency)
            }
            
            const c = /^FIN:([A-Za-z0-9_-]+):([A-Za-z0-9_-]+)$/.exec(msg)
            if (c) {
              paymentLogger.customer.rx(`FIN message received`, { 
                nonce: c[1], 
                merchantId: c[2], 
                currentNonce: currentNonceRef.current, 
                customerState: customerStateRef.current,
                receiverActive: !!customerReceiverRef.current,
                timestamp: new Date().toISOString()
              })
              if (currentNonceRef.current && c[1] === currentNonceRef.current && customerStateRef.current === 'sent_payack') {
                paymentLogger.customer.success('FIN processing successful', { nonce: c[1], merchantId: c[2] })
                setCustomerStatus('Payment confirmed by merchant.')
                setShowCustomerLoading(false)
                setShowCustomerInput(false)
                setShowCustomerSuccess(true)
                setCustomerState('confirmed')
                customerStateRef.current = 'confirmed'
                setShowCustomerRetry(false)
                setWaitingForConfirmation(false)
              } else {
                paymentLogger.customer.warning('FIN ignored', { 
                  nonceMatch: currentNonceRef.current && c[1] === currentNonceRef.current, 
                  stateMatch: customerStateRef.current === 'sent_payack',
                  currentNonce: currentNonceRef.current,
                  customerState: customerStateRef.current,
                  receiverActive: !!customerReceiverRef.current
                })
              }
            }
          })
        },
        onCreate: () => paymentLogger.customer.success('Receiver created successfully'),
        onCreateFail: (r: any) => {
          paymentLogger.customer.error('Receiver creation failed', r)
          setCustomerStatus('Receiver failed: ' + r + '. Try a different profile.')
          // Don't crash the app, just show error
        },
        onReceiveFail: (e: any) => paymentLogger.customer.error('Receive error', e)
      })
    } catch (e: any) {
      setCustomerStatus('Receiver error: ' + e.message)
    }
  }

  // Send payment request
  const sendPaymentRequest = () => {
    if (!isReady || !merchantEnabled) return
    
    const amount = merchantAmount.trim()
    if (!amount || isNaN(Number(amount))) {
      setMerchantStatus('Enter a valid amount.')
      return
    }
    
    const currency = 'USD'
    const nonce = Math.random().toString(36).slice(2, 10)
    const payReq: PaymentRequest = { 
      amount, 
      currency: currency || 'USD', 
      nonce, 
      merchantId, 
      timestamp: Date.now() 
    }
    
    setCurrentNonce(nonce)
    setLastPayReq(payReq)
    setMerchantStatus('Transmitting payment request...')
    setShowMerchantLoading(true)
    setMerchantTransmitting(true)
    setMerchantTransmitComplete(false)
    setShowMerchantRetry(false)
    
    // Update refs immediately for synchronous access
    currentNonceRef.current = nonce
    lastPayReqRef.current = payReq
    
    const msg = 'PRQ:' + amount + ':' + currency + ':' + nonce + ':' + merchantId + '\n'
    
    // Check message length (most profiles can handle up to 50 characters)
    if (msg.length > 50) {
      setMerchantStatus('Message too long for current profile. Try a shorter amount.')
      setShowMerchantLoading(false)
      setMerchantTransmitting(false)
      return
    }
    
    try {
      if (merchantTransmitterRef.current) {
        merchantTransmitterRef.current.destroy()
      }
      
      const payload = window.Quiet.str2ab(msg)
      merchantTransmitterRef.current = window.Quiet.transmitter({
        profile,
        onFinish: () => {
          paymentLogger.merchant.success('Payment request transmission completed')
          setMerchantTransmitting(false)
          setMerchantTransmitComplete(true)
          setMerchantStatus('Payment request sent. Listening for authorization.')
          setShowMerchantLoading(false)
          setWaitingForAuthorization(true)
          
          // Show retry button after 3 seconds if no response
          setTimeout(() => {
            if (merchantStateRef.current === 'awaiting_payack') {
              setShowMerchantRetry(true)
              setWaitingForAuthorization(false)
            }
          }, 3000)
        },
        onCreateFail: (error: any) => {
          paymentLogger.merchant.error('Payment request transmitter creation failed', error)
          setMerchantStatus('Transmitter failed: ' + error + '. Try a different profile.')
          setShowMerchantLoading(false)
          setMerchantTransmitting(false)
        }
      })
      
      // Set state to awaiting_payack AFTER transmitter is created
      setMerchantState('awaiting_payack')
      merchantStateRef.current = 'awaiting_payack' // Update ref immediately
      paymentLogger.merchant.tx(`Payment request attempt 1: ${msg.trim()}`)
      merchantTransmitterRef.current.transmit(payload)
      
      setTimeout(() => {
        try {
          paymentLogger.merchant.tx(`Payment request attempt 2: ${msg.trim()}`)
          merchantTransmitterRef.current.transmit(payload)
        } catch (e: any) {
          paymentLogger.merchant.warning('Payment request attempt 2 error', e)
        }
      }, 180)
      
      setTimeout(() => {
        setMerchantStatus('Payment request sent. Listening for authorization.')
      }, 220)
    } catch (e: any) {
      paymentLogger.merchant.error('Payment request transmission error', e)
      setMerchantStatus('Payment request failed: ' + e.message)
      setShowMerchantLoading(false)
    }
  }

  // Send payment acknowledgment
  const sendPaymentAck = async () => {
    if (!isReady || !customerEnabled) return
    if (!currentNonce) {
      setCustomerStatus('No payment request received yet.')
      return
    }
    
    const pin = customerPin.trim()
    if (!pin) {
      setCustomerStatus('Enter PIN to authorize.')
      return
    }
    if (pin.length !== 4) {
      setCustomerStatus('PIN must be exactly 4 digits.')
      return
    }
    
    setCustomerStatus('Authorizing payment...')
    setShowCustomerLoading(true)
    setShowCustomerInput(false)
    setCustomerTransmitting(true)
    setCustomerTransmitComplete(false)
    setShowCustomerRetry(false)
    
    try {
      const tokenHash = (await sha256Hex(currentNonce + ':' + pin)).slice(0, 8)
      const msg = 'ACK:' + currentNonce + ':' + tokenHash + ':' + customerId + '\n'
      
      // Check message length (most profiles can handle up to 50 characters)
      if (msg.length > 50) {
        setCustomerStatus('Message too long for current profile.')
        setShowCustomerLoading(false)
        setShowCustomerInput(true)
        setCustomerTransmitting(false)
        return
      }
      
      if (customerTransmitterRef.current) {
        customerTransmitterRef.current.destroy()
      }
      
      const payload = window.Quiet.str2ab(msg)
      customerTransmitterRef.current = window.Quiet.transmitter({
        profile,
        onFinish: () => {
          paymentLogger.customer.success('Payment authorization transmission completed')
          setCustomerTransmitting(false)
          setCustomerTransmitComplete(true)
          setCustomerStatus('Authorization sent. Waiting for confirmation...')
          setShowCustomerLoading(false)
          setShowCustomerInput(false) // Keep input hidden after transmission
          setWaitingForConfirmation(true) // Set waiting state
          
          // Show retry button after 3 seconds if no response
          setTimeout(() => {
            if (customerStateRef.current === 'sent_payack') {
              setShowCustomerRetry(true)
              setWaitingForConfirmation(false) // Clear waiting state when showing retry
            }
          }, 3000)
        },
        onCreateFail: (error: any) => {
          paymentLogger.customer.error('Payment authorization transmitter creation failed', error)
          setCustomerStatus('Transmitter failed: ' + error + '. Try a different profile.')
          setShowCustomerLoading(false)
          setShowCustomerInput(true)
          setCustomerTransmitting(false)
        }
      })
      
      setCustomerState('sent_payack')
      customerStateRef.current = 'sent_payack'
      paymentLogger.customer.tx(`Payment authorization attempt 1: ${msg.trim()}`)
      paymentLogger.customer.state('State after ACK', { customerState: 'sent_payack', receiverActive: !!customerReceiverRef.current })
      customerTransmitterRef.current.transmit(payload)
      
      setTimeout(() => {
        try {
          paymentLogger.customer.tx(`Payment authorization attempt 2: ${msg.trim()}`)
          customerTransmitterRef.current.transmit(payload)
        } catch (e: any) {
          paymentLogger.customer.warning('Payment authorization attempt 2 error', e)
        }
      }, 180)
      
      setTimeout(() => {
        setCustomerStatus('Authorization sent. Waiting for confirmation...')
        setShowCustomerLoading(false)
      }, 220)
    } catch (e: any) {
      paymentLogger.customer.error('Payment authorization transmission error', e)
      setCustomerStatus('Authorization failed: ' + e.message)
      setShowCustomerLoading(false)
      setShowCustomerInput(true)
    }
  }

  // Helper functions
  const seen = (msg: string) => {
    const now = Date.now()
    const time = recentMessagesRef.current.get(msg)
    if (time && now - time < 600) {
      seenLogger.duplicate(msg, now - time)
      return true
    }
    recentMessagesRef.current.set(msg, now)
    if (recentMessagesRef.current.size > 200) {
      const cutoff = now - 600
      for (const [k, v] of recentMessagesRef.current) {
        if (v < cutoff) recentMessagesRef.current.delete(k)
      }
    }
    seenLogger.new(msg)
    return false
  }

  const sha256Hex = async (s: string) => {
    const enc = new TextEncoder()
    const buf = enc.encode(s)
    const d = await crypto.subtle.digest('SHA-256', buf)
    return Array.from(new Uint8Array(d)).map(x => x.toString(16).padStart(2, '0')).join('')
  }

  // Reset payment system
  const resetPaymentSystem = () => {
    setMerchantAmount('')
    setCustomerPin('')
    setMerchantState('idle')
    setCustomerState('idle')
    setMerchantStatus('Ready to process payment')
    setCustomerStatus('Ready to pay')
    setMerchantValue('')
    setCustomerValue('')
    setShowMerchantSuccess(false)
    setShowCustomerSuccess(false)
    setShowMerchantLoading(false)
    setShowCustomerLoading(false)
    setShowCustomerInput(false)
    setCurrentNonce(null)
    setMerchantTransmitting(false)
    setCustomerTransmitting(false)
    setMerchantTransmitComplete(false)
    setCustomerTransmitComplete(false)
    setShowMerchantRetry(false)
    setShowCustomerRetry(false)
    setWaitingForConfirmation(false)
    setWaitingForAuthorization(false)
    
    // Reset refs
    merchantStateRef.current = 'idle'
    customerStateRef.current = 'idle'
    currentNonceRef.current = null
    lastPayReqRef.current = null
  }

  const cleanup = () => {
    if (merchantReceiverRef.current) {
      merchantReceiverRef.current.destroy()
      merchantReceiverRef.current = null
    }
    if (merchantTransmitterRef.current) {
      merchantTransmitterRef.current.destroy()
      merchantTransmitterRef.current = null
    }
    if (customerReceiverRef.current) {
      customerReceiverRef.current.destroy()
      customerReceiverRef.current = null
    }
    if (customerTransmitterRef.current) {
      customerTransmitterRef.current.destroy()
      customerTransmitterRef.current = null
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

  // Focus PIN input when it appears
  useEffect(() => {
    if (showCustomerInput && customerPinInputRef.current) {
      // Small delay to ensure the input is fully rendered
      setTimeout(() => {
        customerPinInputRef.current?.focus()
      }, 100)
    }
  }, [showCustomerInput])

  // Start receivers when ready
  useEffect(() => {
    paymentLogger.system.effect('Starting receivers', { isReady, merchantEnabled, customerEnabled, profile })
    if (isReady) {
      if (merchantEnabled) startMerchantRx()
      if (customerEnabled) startCustomerRx()
    }
  }, [isReady, merchantEnabled, customerEnabled, profile])


  return (
    <>
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

      <Card className="mb-3">
        <CardContent className="p-2">
          <div className="flex items-center justify-between flex-wrap gap-1">
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
            <Badge variant="outline" className="text-xs">
              {fps}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col md:flex-row gap-3 md:justify-center md:items-start w-full flex-1 min-h-0 max-w-full overflow-x-hidden">
        {/* Merchant/POS Interface */}
        <Card className={`flex-1 min-h-0 h-[calc(50vh-100px)] md:h-[calc(100vh-200px)] md:aspect-[9/16] transition-all duration-200 ease-in-out flex flex-col ${
          !merchantEnabled ? 'opacity-50 grayscale-[0.3]' : ''
        } ${
          merchantTransmitting ? 'ring-2 ring-blue-300/30 shadow-[0_0_8px_rgba(138,180,248,0.35)] transition-shadow duration-500' : ''
        } ${
          showMerchantSuccess ? 'animate-success-bounce' : ''
        }`}>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base text-blue-400">💳 POS Terminal</CardTitle>
              <div className="flex items-center gap-2 text-xs">
                <Switch 
                  checked={merchantEnabled}
                  onCheckedChange={setMerchantEnabled}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center min-h-0 w-full box-border">
            {showMerchantSuccess ? (
              <div className="w-full flex flex-col gap-4 items-center box-border max-w-full">
                <div className="text-2xl font-semibold">{merchantValue}</div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="w-4 h-4 rounded-full bg-green-500 text-green-900 font-black flex items-center justify-center text-[10px]">✓</span>
                  Payment Received
                </div>
              </div>
            ) : showMerchantRetry ? (
              <div className="w-full flex flex-col gap-3 items-center box-border max-w-full p-4">
                <div className="text-yellow-400 text-sm text-center">No response received. Try again?</div>
                <Button 
                  onClick={() => {
                    setShowMerchantRetry(false)
                    setWaitingForAuthorization(false)
                    sendPaymentRequest()
                  }}
                  disabled={!merchantEnabled || !isReady}
                >
                  Send Again
                </Button>
              </div>
            ) : merchantTransmitting ? (
              <div className="w-full flex flex-col gap-2 items-center box-border max-w-full p-4">
                <div className="spinner"></div>
                <div className="text-base text-muted-foreground text-center">Transmitting payment request...</div>
              </div>
            ) : waitingForAuthorization ? (
              <div className="w-full flex flex-col gap-3 items-center box-border max-w-full">
                <div className="text-base text-muted-foreground text-center">Waiting for authorization...</div>
              </div>
            ) : showMerchantLoading ? (
              <div className="w-full flex flex-col gap-4 items-center box-border max-w-full">
                <div className="spinner"></div>
              </div>
            ) : (
              <div className="w-full flex flex-col gap-3 items-center box-border max-w-full">
                <Input 
                  type="text"
                  placeholder="Enter amount (e.g., 25.50)"
                  value={merchantAmount}
                  onChange={(e) => setMerchantAmount(e.target.value)}
                  onKeyUp={(e) => e.key === 'Enter' && sendPaymentRequest()}
                  disabled={!merchantEnabled || !isReady}
                  className="w-full text-center"
                />
                <div className="text-xs text-muted-foreground text-center">Press Enter to generate payment request</div>
              </div>
            )}
          </CardContent>
          
          <div className="mt-auto p-4 border-t">
            <div className="text-xs text-muted-foreground text-center">{merchantStatus}</div>
          </div>
        </Card>

        {/* Customer Interface */}
        <Card className={`flex-1 min-h-0 h-[calc(50vh-100px)] md:h-[calc(100vh-200px)] md:aspect-[9/16] transition-all duration-200 ease-in-out flex flex-col ${
          !customerEnabled ? 'opacity-50 grayscale-[0.3]' : ''
        } ${
          customerTransmitting ? 'ring-2 ring-green-300/30 shadow-[0_0_8px_rgba(52,211,153,0.35)] transition-shadow duration-500' : ''
        } ${
          showCustomerSuccess ? 'animate-success-bounce' : ''
        }`}>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base text-green-400">📱 Customer Payment</CardTitle>
              <div className="flex items-center gap-2 text-xs">
                <Switch 
                  checked={customerEnabled}
                  onCheckedChange={setCustomerEnabled}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center min-h-0 w-full box-border">
            {showCustomerSuccess ? (
              <div className="w-full flex flex-col gap-4 items-center box-border max-w-full">
                <div className="text-2xl font-semibold">{customerValue}</div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="w-4 h-4 rounded-full bg-green-500 text-green-900 font-black flex items-center justify-center text-[10px]">✓</span>
                  Payment Sent
                </div>
              </div>
            ) : showCustomerRetry ? (
              <div className="w-full flex flex-col gap-3 items-center box-border max-w-full p-4">
                <div className="text-yellow-400 text-sm text-center">No confirmation received. Try again?</div>
                <Button 
                  onClick={() => {
                    setShowCustomerRetry(false)
                    setWaitingForConfirmation(false)
                    sendPaymentAck()
                  }}
                  disabled={!customerEnabled || !isReady}
                >
                  Send Again
                </Button>
              </div>
            ) : customerTransmitting ? (
              <div className="w-full flex flex-col gap-2 items-center box-border max-w-full p-4">
                <div className="spinner"></div>
                <div className="text-base text-muted-foreground text-center">Transmitting authorization...</div>
              </div>
            ) : waitingForConfirmation ? (
              <div className="w-full flex flex-col gap-3 items-center box-border max-w-full">
                <div className="text-base text-muted-foreground text-center">Waiting for confirmation...</div>
              </div>
            ) : showCustomerInput ? (
              <div className="w-full flex flex-col gap-3 items-center box-border max-w-full">
                <Input 
                  ref={customerPinInputRef}
                  type="text"
                  placeholder="Enter 4-digit PIN"
                  value={customerPin}
                  onChange={(e) => {
                    // Only allow numbers
                    const value = e.target.value.replace(/[^0-9]/g, '')
                    setCustomerPin(value)
                  }}
                  onKeyUp={(e) => {
                    if (e.key === 'Enter' && customerPin.length === 4) {
                      sendPaymentAck()
                    }
                  }}
                  maxLength={4}
                  disabled={!customerEnabled || !isReady}
                  className="w-full text-center"
                />
                <div className="text-xs text-muted-foreground text-center">Enter 4-digit PIN and press Enter to pay</div>
              </div>
            ) : showCustomerLoading ? (
              <div className="w-full flex flex-col gap-4 items-center box-border max-w-full">
                <div className="spinner"></div>
              </div>
            ) : (
              <div className="w-full flex flex-col gap-3 items-center box-border max-w-full">
                <div className="text-base text-muted-foreground text-center">Waiting for payment request…</div>
              </div>
            )}
          </CardContent>
          
          <div className="mt-auto p-4 border-t">
            <div className="text-xs text-muted-foreground text-center">{customerStatus}</div>
          </div>
        </Card>
      </div>

      {!isReady && (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/80 flex items-center justify-center z-[1000]">
          <Card className="p-8 text-center">
            <CardContent className="flex flex-col gap-4 items-center">
              <div className="spinner"></div>
              <p className="m-0 text-base">Initializing ultrasound communication...</p>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}

export default PaymentInterface
