// Shared type definitions

export type ProfileType = 'ultrasonic' | 'audible'

export type StateType = 'idle' | 'listening' | 'transmitting' | 'processing' | 'success' | 'error' | 'awaiting_payack' | 'authorized' | 'received_payreq' | 'confirmed' | 'sent_payack'

export interface PaymentRequest {
  amount: string
  merchantId: string
  nonce: string
  timestamp: number
  currency?: string
}

export interface PaymentResponse {
  success: boolean
  transactionId?: string
  error?: string
  timestamp: number
}

export interface Message {
  id: string
  text: string
  timestamp: number
  sender: 'user' | 'received'
  type?: string
  status?: 'sending' | 'sent' | 'delivered' | 'failed'
  retryCount?: number
}

export interface TransmissionRecord {
  id: string
  text: string
  timestamp: number
  direction: 'sent' | 'received'
  type?: string
}

// Extend Window interface for Quiet.js
declare global {
  interface Window {
    Quiet: any
    webkitAudioContext: typeof AudioContext
  }
}
