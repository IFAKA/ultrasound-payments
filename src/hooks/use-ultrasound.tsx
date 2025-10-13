import { useState, useEffect, useRef, useCallback } from 'react'
import { ProfileType } from '../types'
import { initializeQuiet } from '../utils/quietInit'
import { useIsMobile } from './use-mobile'

interface UseUltrasoundOptions {
  profile: ProfileType
  logger: {
    error: (message: string, error?: any) => void
    success: (message: string) => void
    tx: (data: string) => void
  }
}

export const useUltrasound = ({ profile, logger }: UseUltrasoundOptions) => {
  const [isReady, setIsReady] = useState<boolean>(false)
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false)
  const [isReceiving, setIsReceiving] = useState<boolean>(false)
  const [audioLevel, setAudioLevel] = useState<number>(0)
  const [detectedFreq, setDetectedFreq] = useState<string>('—')
  const isMobile = useIsMobile()
  const [sessionId] = useState<string>(() => Math.random().toString(36).slice(2, 10))

  // Audio visualization refs
  const micVizRef = useRef<HTMLCanvasElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)
  const rafIdRef = useRef<number | null>(null)

  // Ultrasound refs
  const receiverRef = useRef<any>(null)
  const transmitterRef = useRef<any>(null)
  const receiveBufferRef = useRef<string>('')

  // Initialize Quiet.js
  useEffect(() => {
    const initQuiet = async () => {
      try {
        await initializeQuiet()
        setIsReady(true)
      } catch (error) {
        logger.error('Failed to initialize Quiet.js', error)
      }
    }

    initQuiet()
    initMicVisualizer()

    return () => {
      cleanup()
    }
  }, [])

  // Initialize microphone visualizer
  const initMicVisualizer = useCallback(() => {
    if (!micVizRef.current) return

    try {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      analyserRef.current = audioCtxRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      analyserRef.current.smoothingTimeConstant = 0.8

      const bufferLength = analyserRef.current.frequencyBinCount
      dataArrayRef.current = new Uint8Array(bufferLength)

      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          const source = audioCtxRef.current!.createMediaStreamSource(stream)
          source.connect(analyserRef.current!)
          updateMicVisualizer()
        })
        .catch(err => {
          console.warn('Microphone access denied:', err)
        })
    } catch (error) {
      console.warn('Audio context initialization failed:', error)
    }
  }, [])

  // Update microphone visualizer
  const updateMicVisualizer = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current || !micVizRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)
    
    const canvas = micVizRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    
    ctx.clearRect(0, 0, width, height)
    
    const barWidth = width / dataArray.length
    let maxFreq = 0
    let maxIndex = 0
    
    for (let i = 0; i < dataArray.length; i++) {
      const barHeight = (dataArray[i] / 255) * height
      const x = i * barWidth
      
      // Calculate frequency (rough approximation)
      const freq = (i * audioCtxRef.current!.sampleRate) / (2 * dataArray.length)
      if (dataArray[i] > maxFreq) {
        maxFreq = dataArray[i]
        maxIndex = i
      }
      
      // Color based on frequency range
      let color = '#10b981' // green
      if (freq > 15000) color = '#3b82f6' // blue
      if (freq > 18000) color = '#8b5cf6' // purple
      
      ctx.fillStyle = color
      ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight)
    }
    
    // Update audio level and detected frequency
    const avgLevel = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
    setAudioLevel(Math.round((avgLevel / 255) * 100))
    
    if (maxFreq > 10) {
      const detectedFreq = Math.round((maxIndex * audioCtxRef.current!.sampleRate) / (2 * dataArray.length))
      setDetectedFreq(detectedFreq.toString())
    } else {
      setDetectedFreq('—')
    }
    
    rafIdRef.current = requestAnimationFrame(updateMicVisualizer)
  }, [])

  // Start receiver
  const startReceiver = useCallback((onReceive: (data: string) => void) => {
    if (!isReady || receiverRef.current) return

    try {
      // Ensure audio context is resumed
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        console.log('FileTransfer: Resuming audio context for receiver')
        audioCtxRef.current.resume()
      }
      
      receiverRef.current = window.Quiet.receiver({
        profile,
        onReceive: (payload: ArrayBuffer) => {
          const text = window.Quiet.ab2str(payload) || ''
          console.log('FileTransfer: Raw received data:', text.substring(0, 100) + (text.length > 100 ? '...' : ''))
          receiveBufferRef.current += text
          
          // Process complete lines
          const lines = receiveBufferRef.current.split('\n')
          receiveBufferRef.current = lines.pop() || '' // Keep incomplete line in buffer
          
          // Process each complete line
          lines.forEach(line => {
            const trimmedLine = line.trim()
            if (trimmedLine) {
              console.log('FileTransfer: Processing received line:', trimmedLine.substring(0, 50) + '...')
              console.log('FileTransfer: Full received line:', trimmedLine)
              onReceive(trimmedLine)
            }
          })
        }
      })
      setIsReceiving(true)
      console.log('FileTransfer: Receiver started successfully')
      console.log('FileTransfer: Audio context state:', audioCtxRef.current?.state)
    } catch (error) {
      logger.error('Failed to start receiver', error)
    }
  }, [isReady, profile, logger])

  // Send data
  const sendData = useCallback((data: string, onFinish?: () => void) => {
    if (!isReady || isTransmitting) return false

    setIsTransmitting(true)
    
    try {
      if (transmitterRef.current) {
        transmitterRef.current.destroy()
      }
      
      const payload = window.Quiet.str2ab(data + '\n')
      transmitterRef.current = window.Quiet.transmitter({
        profile,
        onFinish: () => {
          logger.success('Transmission completed')
          setIsTransmitting(false)
          
          // Ensure audio context is resumed after transmission
          if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
            console.log('FileTransfer: Resuming audio context after transmission')
            audioCtxRef.current.resume()
          }
          
          onFinish?.()
        }
      })
      
      logger.tx(data)
      console.log('FileTransfer: Transmitting data:', data.substring(0, 100) + (data.length > 100 ? '...' : ''))
      console.log('FileTransfer: Audio context state before transmit:', audioCtxRef.current?.state)
      transmitterRef.current.transmit(payload)
      return true
    } catch (error) {
      logger.error('Transmission error', error)
      setIsTransmitting(false)
      return false
    }
  }, [isReady, isTransmitting, profile, logger])

  // Cleanup function
  const cleanup = useCallback(() => {
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
    receiveBufferRef.current = ''
    setIsReceiving(false)
  }, [])

  return {
    // State
    isReady,
    isTransmitting,
    isReceiving,
    audioLevel,
    detectedFreq,
    isMobile,
    sessionId,
    
    // Refs
    micVizRef,
    
    // Functions
    startReceiver,
    sendData,
    cleanup,
  }
}
