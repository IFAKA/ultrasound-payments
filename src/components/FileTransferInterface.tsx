import { useState, useEffect, useRef } from 'react'
import { ProfileType } from '../types'
import { useUltrasound } from '../hooks/use-ultrasound'
import ProfileSelector from './ProfileSelector'
import AudioVisualizer from './AudioVisualizer'
import LoadingOverlay from './LoadingOverlay'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, CheckCircle, Upload, Download, File, X, Clock, RotateCcw } from 'lucide-react'

interface FileTransferInterfaceProps {
  profile: ProfileType
  onProfileChange: (profile: ProfileType) => void
}

interface FileTransfer {
  id: string
  name: string
  size: number
  type: string
  data: string
  status: 'pending' | 'sending' | 'sent' | 'receiving' | 'received' | 'failed' | 'awaiting_confirmation' | 'confirmed' | 'rejected' | 'cancelled' | 'paused_sending' | 'paused_receiving'
  progress: number
  timestamp: number
  direction: 'sent' | 'received'
  error?: string
  senderId?: string
  receiverId?: string
  transferId?: string
}

interface FileTransferRequest {
  transferId: string
  senderId: string
  fileName: string
  fileSize: number
  fileType: string
  timestamp: number
  totalChunks: number
  chunkSize: number
}

interface FileChunk {
  transferId: string
  chunkIndex: number
  totalChunks: number
  data: string
  checksum: string
  senderId: string
}

interface ChunkStatus {
  chunkIndex: number
  status: 'pending' | 'sending' | 'sent' | 'received' | 'failed' | 'verified'
  checksum?: string
  retryCount: number
  lastSentTime?: number
  lastAckTime?: number
}

interface ConnectionHeartbeat {
  transferId: string
  senderId: string
  timestamp: number
  chunkProgress: number
  totalChunks: number
}

const FileTransferInterface = ({ profile, onProfileChange }: FileTransferInterfaceProps) => {
  const [transfers, setTransfers] = useState<FileTransfer[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [pendingRequests, setPendingRequests] = useState<FileTransferRequest[]>([])
  const [deviceId] = useState<string>(() => 'FT-' + Math.random().toString(36).slice(2, 10))
  const [chunkStatuses, setChunkStatuses] = useState<Map<string, ChunkStatus[]>>(new Map())
  const [receivedChunks, setReceivedChunks] = useState<Map<string, Map<number, string>>>(new Map())
  const [activeTransfers, setActiveTransfers] = useState<Set<string>>(new Set()) // For UI updates
  const activeTransfersRef = useRef<Set<string>>(new Set()) // For synchronous access
  const [confirmationTimeouts, setConfirmationTimeouts] = useState<Map<string, NodeJS.Timeout>>(new Map())
  const [heartbeatIntervals, setHeartbeatIntervals] = useState<Map<string, NodeJS.Timeout>>(new Map())
  const [lastHeartbeat, setLastHeartbeat] = useState<Map<string, number>>(new Map())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const transfersRef = useRef<FileTransfer[]>([])
  
  // Configuration
  const CHUNK_SIZE = 1000 // Base64 characters per chunk (adjust based on ultrasound profile)
  const MAX_RETRIES = 3

  // Transfer rate estimation based on profile (bytes per second)
  const getTransferRate = (profile: ProfileType): number => {
    switch (profile) {
      case 'ultrasonic':
        return 200 // ~200 bytes/sec for ultrasonic
      case 'audible':
        return 150 // ~150 bytes/sec for audible
      default:
        return 150 // default rate
    }
  }

  // Calculate estimated transfer time
  const calculateTransferTime = (fileSize: number, profile: ProfileType): number => {
    const rate = getTransferRate(profile)
    // Account for base64 encoding overhead (33% increase) and protocol overhead
    const effectiveSize = fileSize * 1.4
    return Math.ceil(effectiveSize / rate)
  }

  // Format time duration
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = seconds % 60
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
    } else {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
    }
  }

  // Calculate time remaining for active transfer
  const calculateTimeRemaining = (transfer: FileTransfer): string => {
    if (transfer.status !== 'sending' || transfer.progress === 0) {
      return formatDuration(calculateTransferTime(transfer.size, profile))
    }

    // const startTime = transferStartTimes.get(transfer.transferId || '')
    // if (!startTime) {
      return formatDuration(calculateTransferTime(transfer.size, profile))
    // }

    // const elapsed = (Date.now() - startTime) / 1000
    // const totalEstimated = calculateTransferTime(transfer.size, profile)
    // const remaining = Math.max(0, totalEstimated - elapsed)
    
    // return formatDuration(Math.ceil(remaining))
  }

  // Utility functions
  const calculateChecksum = async (data: string): Promise<string> => {
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(data)
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8)
  }

  const chunkFile = (fileData: string): string[] => {
    const chunks: string[] = []
    for (let i = 0; i < fileData.length; i += CHUNK_SIZE) {
      chunks.push(fileData.slice(i, i + CHUNK_SIZE))
    }
    return chunks
  }

  const {
    isReady,
    isTransmitting,
    audioLevel,
    detectedFreq,
    isMobile,
    micVizRef,
    startReceiver,
    sendData,
  } = useUltrasound({ profile, logger: { error: console.error, success: console.log, tx: console.log } })

  // Handle received file data
  // Buffer for chunked file transfer requests (using ref for synchronous access)
  const requestBufferRef = useRef<{[key: string]: string}>({})

  const handleReceive = (line: string) => {
    if (!line) return

    console.log('FileTransfer: Received line:', line.substring(0, 100) + '...')
    console.log('FileTransfer: Full received line:', line)
    
    // Handle chunked file transfer request start
    if (line.startsWith('FTR_START:')) {
      const chunkData = line.substring(10) // Remove 'FTR_START:' prefix
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
      requestBufferRef.current[requestId] = chunkData
      console.log('FileTransfer: Started receiving chunked request:', requestId)
    }
    // Handle chunked file transfer request chunk
    else if (line.startsWith('FTR_CHUNK:')) {
      const chunkData = line.substring(10) // Remove 'FTR_CHUNK:' prefix
      // Find the most recent request buffer entry
      const requestIds = Object.keys(requestBufferRef.current)
      console.log('FileTransfer: Processing FTR_CHUNK, current buffer keys:', requestIds)
      if (requestIds.length > 0) {
        const latestRequestId = requestIds[requestIds.length - 1]
        requestBufferRef.current[latestRequestId] = (requestBufferRef.current[latestRequestId] || '') + chunkData
        console.log('FileTransfer: Added chunk to buffer:', latestRequestId, 'Chunk data:', chunkData)
        console.log('FileTransfer: Current buffer content:', requestBufferRef.current[latestRequestId])
        console.log('FileTransfer: Received request chunk for:', latestRequestId)
      } else {
        console.log('FileTransfer: No active request buffer found for chunk:', chunkData)
      }
    }
    // Handle chunks that lost their prefix due to corruption
    else if (Object.keys(requestBufferRef.current).length > 0 && 
             (line.includes('"senderId"') || line.includes('"fileName"') || 
              line.includes('"fileSize"') || line.includes('"fileType"') || 
              line.includes('"timestamp"') || line.includes('"totalChunks"') || 
              line.includes('"chunkSize"') || line.includes('}') || line.includes('"'))) {
      // This looks like a chunk that lost its prefix, add it to the buffer
      const requestIds = Object.keys(requestBufferRef.current)
      if (requestIds.length > 0) {
        const latestRequestId = requestIds[requestIds.length - 1]
        requestBufferRef.current[latestRequestId] = (requestBufferRef.current[latestRequestId] || '') + line
        console.log('FileTransfer: Received corrupted chunk (no prefix) for:', latestRequestId, 'Data:', line)
      }
    }
    // Handle chunked file transfer request end
    else if (line.startsWith('FTR_END:')) {
      const chunkData = line.substring(8) // Remove 'FTR_END:' prefix
      // Find the most recent request buffer entry
      const requestIds = Object.keys(requestBufferRef.current)
      console.log('FileTransfer: Processing FTR_END, current buffer keys:', requestIds)
      if (requestIds.length > 0) {
        const latestRequestId = requestIds[requestIds.length - 1]
        const completeRequest = requestBufferRef.current[latestRequestId] + chunkData
        
        console.log('FileTransfer: Completed chunked request:', latestRequestId)
        console.log('FileTransfer: Complete request data:', completeRequest)
        
        // Process the complete request
        handleFileTransferRequest('FTR:' + completeRequest)
        
        // Clear the buffer entry
        delete requestBufferRef.current[latestRequestId]
      } else {
        console.log('FileTransfer: No active request buffer found for FTR_END:', chunkData)
      }
    }
    // Handle FTR_END that lost its prefix due to corruption
    else if (Object.keys(requestBufferRef.current).length > 0 && 
             (line.includes('"chunkSize"') && line.includes('}')) && 
             !line.startsWith('FTR_')) {
      // This looks like the end chunk that lost its prefix
      const requestIds = Object.keys(requestBufferRef.current)
      if (requestIds.length > 0) {
        const latestRequestId = requestIds[requestIds.length - 1]
        const completeRequest = requestBufferRef.current[latestRequestId] + line
        
        console.log('FileTransfer: Completed chunked request (corrupted end):', latestRequestId)
        console.log('FileTransfer: Complete request data:', completeRequest)
        
        // Process the complete request
        handleFileTransferRequest('FTR:' + completeRequest)
        
        // Clear the buffer entry
        delete requestBufferRef.current[latestRequestId]
      }
    }
    // Handle file transfer request (legacy single message)
    else if (line.startsWith('FTR:')) {
      handleFileTransferRequest(line)
    }
    // Handle corrupted file transfer request (missing FTR: prefix)
    else if (line.includes('"transferId"') && line.includes('"senderId"') && line.includes('"fileName"')) {
      console.log('FileTransfer: Detected corrupted file transfer request, attempting to fix')
      handleFileTransferRequest('FTR:' + line)
    }
    // Handle file transfer confirmation
    else if (line.startsWith('FTC:')) {
      console.log('FileTransfer: Processing confirmation:', line)
      handleFileTransferConfirmation(line)
    }
    // Handle file transfer rejection
    else if (line.startsWith('FTRJ:')) {
      handleFileTransferRejection(line)
    }
    // Handle file chunk
    else if (line.startsWith('CHUNK:')) {
      handleFileChunk(line)
    }
    // Handle chunk verification
    else if (line.startsWith('CHUNK_OK:')) {
      handleChunkVerification(line)
    }
    // Handle chunk error
    else if (line.startsWith('CHUNK_ERR:')) {
      handleChunkError(line)
    }
      // Handle transfer cancellation
      else if (line.startsWith('CANCEL:')) {
        handleTransferCancellation(line)
      }
      // Handle connection heartbeat
      else if (line.startsWith('HEARTBEAT:')) {
        handleConnectionHeartbeat(line)
      }
    // Handle heartbeat acknowledgment
    else if (line.startsWith('HEARTBEAT_ACK:')) {
      handleHeartbeatAcknowledgment(line)
    }
    // Handle transfer completion
    else if (line.startsWith('TRANSFER_COMPLETE:')) {
      handleTransferCompletion(line)
    }
    // Handle transfer pause
    else if (line.startsWith('PAUSE:')) {
      handleTransferPause(line)
    }
    // Handle resend request
    else if (line.startsWith('RESEND_REQUEST:')) {
      handleResendRequest(line)
    }
      // Handle actual file data (legacy)
      else if (line.startsWith('FILE_START:')) {
        handleFileData(line)
      }
  }

  // Handle file transfer request
  const handleFileTransferRequest = (line: string) => {
    try {
      const data = line.replace('FTR:', '')
      console.log('FileTransfer: Parsing request data:', data.substring(0, 200) + '...')
      
      // Try to parse JSON, but handle corruption gracefully
      let request: FileTransferRequest
      try {
        request = JSON.parse(data)
      } catch (parseError) {
        console.error('FileTransfer: JSON parse error, attempting to fix corrupted data')
        console.error('Corrupted data:', data)
        
        // Try to extract info from corrupted JSON
        const transferIdMatch = data.match(/"transferId":"([^"]+)"/)
        const senderIdMatch = data.match(/"senderId":"([^"]+)"/)
        const fileNameMatch = data.match(/"fileName":"([^"]+)"/)
        const fileSizeMatch = data.match(/"fileSize":(\d+)/)
        const fileTypeMatch = data.match(/"fileType":"([^"]+)"/)
        const totalChunksMatch = data.match(/"totalChunks":(\d+)/)
        const chunkSizeMatch = data.match(/"chunkSize":(\d+)/)
        const timestampMatch = data.match(/"timestamp":(\d+)/)
        
        if (transferIdMatch && senderIdMatch && fileNameMatch) {
          console.log('FileTransfer: Attempting to reconstruct request from corrupted data')
          // Create a request object with extracted data
          request = {
            transferId: transferIdMatch[1],
            senderId: senderIdMatch[1],
            fileName: fileNameMatch[1],
            fileSize: fileSizeMatch ? parseInt(fileSizeMatch[1]) : 0,
            fileType: fileTypeMatch ? fileTypeMatch[1] : 'unknown',
            timestamp: timestampMatch ? parseInt(timestampMatch[1]) : Date.now(),
            totalChunks: totalChunksMatch ? parseInt(totalChunksMatch[1]) : 0,
            chunkSize: chunkSizeMatch ? parseInt(chunkSizeMatch[1]) : 1000
          }
          console.log('FileTransfer: Reconstructed request:', request)
        } else {
          console.error('FileTransfer: Cannot reconstruct request from corrupted data')
          return
        }
      }
      
      // Validate required fields
      if (!request.transferId || !request.senderId || !request.fileName) {
        console.error('FileTransfer: Invalid request - missing required fields')
        return
      }
      
      // Prevent self-transfer (sender shouldn't receive their own request)
      if (request.senderId === deviceId) {
        console.log('FileTransfer: Ignoring self-transfer request from', request.senderId)
        return
      }
      
      console.log('FileTransfer: Received file transfer request from', request.senderId)
      
      // Add to pending requests for user confirmation
      setPendingRequests(prev => [...prev, request])
    } catch (error) {
      console.error('Failed to parse file transfer request:', error)
      console.error('Raw data:', line)
    }
  }

  // Handle file transfer confirmation
  const handleFileTransferConfirmation = (line: string) => {
    try {
      const transferId = line.replace('FTC:', '')
      console.log('FileTransfer: Received confirmation for transfer', transferId)
      console.log('FileTransfer: Current transfers:', transfers.map(t => ({ id: t.transferId, direction: t.direction, status: t.status })))
      
      // Find the transfer to check if it's from this device
      console.log('FileTransfer: Looking for transfer:', transferId, 'in transfers array of length:', transfers.length)
      console.log('FileTransfer: transfersRef.current length:', transfersRef.current.length)
      const transfer = transfersRef.current.find(t => t.transferId === transferId)
      console.log('FileTransfer: Found transfer:', transfer ? { id: transfer.transferId, direction: transfer.direction, status: transfer.status } : 'null')
      
      if (!transfer || transfer.direction !== 'sent') {
        console.log('FileTransfer: Ignoring confirmation for transfer not sent by this device:', transferId)
        console.log('FileTransfer: Available transfers:', transfers.map(t => ({ id: t.transferId, direction: t.direction, status: t.status })))
        return
      }
      
      // Clear confirmation timeout
      const existingTimeout = confirmationTimeouts.get(transferId)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
        setConfirmationTimeouts(prev => {
          const newMap = new Map(prev)
          newMap.delete(transferId)
          return newMap
        })
      }
      
      // Update transfer status to confirmed
      setTransfers(prev => {
        const updated = prev.map(t => 
          t.transferId === transferId 
            ? { ...t, status: 'confirmed' as const }
            : t
        )
        transfersRef.current = updated
        return updated
      })
      
      // Automatically send file data after confirmation
      console.log('FileTransfer: Starting file data transmission after confirmation')
      
      // Add a small delay to ensure receiver is ready
      setTimeout(() => {
        sendFileData(transferId)
      }, 1000)
    } catch (error) {
      console.error('Failed to parse file transfer confirmation:', error)
    }
  }

  // Handle file transfer rejection
  const handleFileTransferRejection = (line: string) => {
    try {
      const transferId = line.replace('FTRJ:', '')
      console.log('FileTransfer: Received rejection for transfer', transferId)
      
      // Find the transfer to check if it's from this device
      const transfer = transfers.find(t => t.transferId === transferId)
      if (!transfer || transfer.direction !== 'sent') {
        console.log('FileTransfer: Ignoring rejection for transfer not sent by this device:', transferId)
        return
      }
      
      // Update transfer status to rejected
      setTransfers(prev => prev.map(t => 
        t.transferId === transferId 
          ? { ...t, status: 'rejected', error: 'Transfer rejected by receiver' }
          : t
      ))
    } catch (error) {
      console.error('Failed to parse file transfer rejection:', error)
    }
  }

  // Handle file chunk
  const handleFileChunk = async (line: string) => {
    try {
      const data = line.replace('CHUNK:', '')
      let chunk: FileChunk
      
      try {
        chunk = JSON.parse(data)
      } catch (parseError) {
        console.log('FileTransfer: JSON parse error for chunk, attempting to fix corrupted data')
        console.log('FileTransfer: Corrupted chunk data:', data.substring(0, 200) + '...')
        
        // Attempt to reconstruct chunk from corrupted data with more flexible patterns
        const transferIdMatch = data.match(/"transferId":"([^"]+)"/)
        const chunkIndexMatch = data.match(/"chunkIndex":(\d+)/)
        
        // Try multiple patterns for totalChunks
        let totalChunksMatch = data.match(/"totalChunks":(\d+)/)
        if (!totalChunksMatch) {
          totalChunksMatch = data.match(/"totalCh[^"]*":(\d+)/)
        }
        if (!totalChunksMatch) {
          totalChunksMatch = data.match(/totalCh[^"]*":(\d+)/)
        }
        
        // Try multiple patterns for data field
        let dataMatch = data.match(/"data":"([^"]+)"/)
        if (!dataMatch) {
          // Look for data field that might be corrupted
          const dataStart = data.indexOf('"data":"')
          if (dataStart !== -1) {
            const dataStartPos = dataStart + 8
            // Find the end of the data field (look for the next quote followed by comma or closing brace)
            let dataEndPos = dataStartPos
            let quoteCount = 0
            while (dataEndPos < data.length) {
              if (data[dataEndPos] === '"') {
                quoteCount++
                if (quoteCount === 1) {
                  // Found the start of data, now look for the end
                  dataEndPos++
                  while (dataEndPos < data.length && data[dataEndPos] !== '"') {
                    dataEndPos++
                  }
                  if (dataEndPos < data.length) {
                    dataMatch = ['', data.substring(dataStartPos, dataEndPos)]
                    break
                  }
                }
              }
              dataEndPos++
            }
          }
        }
        
        // Try multiple patterns for checksum
        let checksumMatch = data.match(/"checksum":"([^"]+)"/)
        if (!checksumMatch) {
          checksumMatch = data.match(/"checksum":"([^"]*)/)
        }
        if (!checksumMatch) {
          // Look for checksum at the end
          const checksumEnd = data.lastIndexOf('"')
          const checksumStart = data.lastIndexOf('"', checksumEnd - 1)
          if (checksumStart !== -1 && checksumEnd !== -1) {
            const checksumValue = data.substring(checksumStart + 1, checksumEnd)
            if (checksumValue.length === 8) { // SHA-256 checksums are 8 chars
              checksumMatch = ['', checksumValue]
            }
          }
        }
        
        // Try multiple patterns for senderId
        let senderIdMatch = data.match(/"senderId":"([^"]+)"/)
        if (!senderIdMatch) {
          senderIdMatch = data.match(/"senderId":"([^"]*)/)
        }
        if (!senderIdMatch) {
          // Look for senderId pattern
          senderIdMatch = data.match(/senderId":"([^"]+)/)
        }
        
        if (transferIdMatch && chunkIndexMatch && totalChunksMatch && dataMatch && checksumMatch && senderIdMatch) {
          chunk = {
            transferId: transferIdMatch[1],
            chunkIndex: parseInt(chunkIndexMatch[1]),
            totalChunks: parseInt(totalChunksMatch[1]),
            data: dataMatch[1],
            checksum: checksumMatch[1],
            senderId: senderIdMatch[1]
          }
          console.log('FileTransfer: Successfully reconstructed chunk from corrupted data')
          console.log('FileTransfer: Reconstructed chunk:', {
            transferId: chunk.transferId,
            chunkIndex: chunk.chunkIndex,
            totalChunks: chunk.totalChunks,
            dataLength: chunk.data.length,
            checksum: chunk.checksum,
            senderId: chunk.senderId
          })
        } else {
          console.log('FileTransfer: Cannot reconstruct chunk from corrupted data')
          console.log('FileTransfer: Missing fields:', {
            transferId: !!transferIdMatch,
            chunkIndex: !!chunkIndexMatch,
            totalChunks: !!totalChunksMatch,
            data: !!dataMatch,
            checksum: !!checksumMatch,
            senderId: !!senderIdMatch
          })
          return
        }
      }
      
      // Prevent self-transfer (sender shouldn't receive their own chunks)
      if (chunk.senderId === deviceId) {
        console.log('FileTransfer: Ignoring self-chunk from', chunk.senderId)
        return
      }
      
      console.log('FileTransfer: Received chunk', chunk.chunkIndex, 'of', chunk.totalChunks, 'for transfer', chunk.transferId)
      
      // Verify chunk checksum
      const calculatedChecksum = await calculateChecksum(chunk.data)
      if (calculatedChecksum !== chunk.checksum) {
        console.error('FileTransfer: Chunk checksum mismatch for chunk', chunk.chunkIndex)
        // Send error response
        const errorString = `CHUNK_ERR:${chunk.transferId}:${chunk.chunkIndex}\n`
        sendData(errorString, () => {
          console.log('FileTransfer: Sent chunk error response')
        })
        return
      }
      
      // Store received chunk
      setReceivedChunks(prev => {
        const newMap = new Map(prev)
        if (!newMap.has(chunk.transferId)) {
          newMap.set(chunk.transferId, new Map())
        }
        const chunks = newMap.get(chunk.transferId)!
        chunks.set(chunk.chunkIndex, chunk.data)
        return newMap
      })
      
      // Send success response
      const successString = `CHUNK_OK:${chunk.transferId}:${chunk.chunkIndex}\n`
      sendData(successString, () => {
        console.log('FileTransfer: Sent chunk success response')
      })
      
      // Check if all chunks received
      const receivedChunksMap = receivedChunks.get(chunk.transferId) || new Map()
      receivedChunksMap.set(chunk.chunkIndex, chunk.data)
      setReceivedChunks(prev => new Map(prev).set(chunk.transferId, receivedChunksMap))
      
      // Update progress for receiver
      const progress = Math.round((receivedChunksMap.size / chunk.totalChunks) * 100)
      setTransfers(prev => prev.map(t => 
        t.transferId === chunk.transferId 
          ? { ...t, status: 'receiving' as const, progress }
          : t
      ))
      
      if (receivedChunksMap.size === chunk.totalChunks) {
        console.log('FileTransfer: All chunks received, reconstructing file')
        await reconstructFile(chunk.transferId, chunk.totalChunks)
      }
      
    } catch (error) {
      console.error('Failed to parse file chunk:', error)
    }
  }

  // Handle chunk verification
  const handleChunkVerification = (line: string) => {
    try {
      const data = line.replace('CHUNK_OK:', '')
      const [transferId, chunkIndexStr] = data.split(':')
      const chunkIndex = parseInt(chunkIndexStr)
      
      // Find the transfer to check if it's from this device
      const transfer = transfers.find(t => t.transferId === transferId)
      if (!transfer || transfer.direction !== 'sent') {
        console.log('FileTransfer: Ignoring chunk verification for transfer not sent by this device:', transferId)
        return
      }
      
      console.log('FileTransfer: Chunk', chunkIndex, 'verified for transfer', transferId)
      
      // Update chunk status with acknowledgment time
      setChunkStatuses(prev => {
        const newMap = new Map(prev)
        const statuses = newMap.get(transferId) || []
        const updatedStatuses = statuses.map(status => 
          status.chunkIndex === chunkIndex 
            ? { ...status, status: 'verified' as const, lastAckTime: Date.now() }
            : status
        )
        newMap.set(transferId, updatedStatuses)
        return newMap
      })
      
      // Update last heartbeat time (chunk verification is a form of heartbeat)
      setLastHeartbeat(prev => new Map(prev).set(transferId, Date.now()))
      
      // Check if all chunks sent
      const statuses = chunkStatuses.get(transferId) || []
      const allVerified = statuses.every(status => status.status === 'verified')
      
      if (allVerified) {
        console.log('FileTransfer: All chunks verified for transfer', transferId)
        setTransfers(prev => prev.map(t => 
          t.transferId === transferId 
            ? { ...t, status: 'sent', progress: 100 }
            : t
        ))
        
        // Remove from active transfers and cleanup
        setActiveTransfers(prev => {
          const newSet = new Set(prev)
          newSet.delete(transferId)
          return newSet
        })
        
        // Clear transfer start time
        // setTransferStartTimes(prev => {
        //   const newMap = new Map(prev)
        //   newMap.delete(transferId)
        //   return newMap
        // })
        
        // Clear heartbeat interval
        const heartbeatInterval = heartbeatIntervals.get(transferId)
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval)
          setHeartbeatIntervals(prev => {
            const newMap = new Map(prev)
            newMap.delete(transferId)
            return newMap
          })
        }
        
        setSelectedFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
      
    } catch (error) {
      console.error('Failed to parse chunk verification:', error)
    }
  }

  // Handle chunk error
  const handleChunkError = (line: string) => {
    try {
      const data = line.replace('CHUNK_ERR:', '')
      const [transferId, chunkIndexStr] = data.split(':')
      const chunkIndex = parseInt(chunkIndexStr)
      
      // Find the transfer to check if it's from this device
      const transfer = transfers.find(t => t.transferId === transferId)
      if (!transfer || transfer.direction !== 'sent') {
        console.log('FileTransfer: Ignoring chunk error for transfer not sent by this device:', transferId)
        return
      }
      
      console.log('FileTransfer: Chunk', chunkIndex, 'failed for transfer', transferId)
      
      // Update chunk status and retry
      setChunkStatuses(prev => {
        const newMap = new Map(prev)
        const statuses = newMap.get(transferId) || []
        const updatedStatuses = statuses.map(status => 
          status.chunkIndex === chunkIndex 
            ? { ...status, status: 'failed' as const, retryCount: status.retryCount + 1 }
            : status
        )
        newMap.set(transferId, updatedStatuses)
        return newMap
      })
      
      // Retry chunk if retry count is below max
      const statuses = chunkStatuses.get(transferId) || []
      const chunkStatus = statuses.find(s => s.chunkIndex === chunkIndex)
      
      if (chunkStatus && chunkStatus.retryCount < MAX_RETRIES) {
        console.log('FileTransfer: Retrying chunk', chunkIndex, 'attempt', chunkStatus.retryCount + 1)
        // Retry logic will be handled by the sending side
      } else {
        console.error('FileTransfer: Max retries exceeded for chunk', chunkIndex)
        setTransfers(prev => prev.map(t => 
          t.transferId === transferId 
            ? { ...t, status: 'failed', error: `Chunk ${chunkIndex} failed after ${MAX_RETRIES} retries` }
            : t
        ))
      }
      
    } catch (error) {
      console.error('Failed to parse chunk error:', error)
    }
  }

  // Handle transfer cancellation
  const handleTransferCancellation = (line: string) => {
    try {
      const transferId = line.replace('CANCEL:', '')
      console.log('FileTransfer: Received cancellation for transfer', transferId)
      
      // Update transfer status to cancelled
      setTransfers(prev => prev.map(t => 
        t.transferId === transferId 
          ? { ...t, status: 'cancelled', error: 'Transfer cancelled' }
          : t
      ))
      
      // Remove from active transfers
      setActiveTransfers(prev => {
        const newSet = new Set(prev)
        newSet.delete(transferId)
        return newSet
      })
      
      // Clean up chunk data
      setChunkStatuses(prev => {
        const newMap = new Map(prev)
        newMap.delete(transferId)
        return newMap
      })
      
      setReceivedChunks(prev => {
        const newMap = new Map(prev)
        newMap.delete(transferId)
        return newMap
      })
      
    } catch (error) {
      console.error('Failed to parse transfer cancellation:', error)
    }
  }

  // Handle connection heartbeat
  const handleConnectionHeartbeat = (line: string) => {
    try {
      const data = line.replace('HEARTBEAT:', '')
      const heartbeat: ConnectionHeartbeat = JSON.parse(data)
      
      // Prevent self-heartbeat (sender shouldn't receive their own heartbeats)
      if (heartbeat.senderId === deviceId) {
        console.log('FileTransfer: Ignoring self-heartbeat from', heartbeat.senderId)
        return
      }
      
      console.log('FileTransfer: Received heartbeat for transfer', heartbeat.transferId, 'progress:', heartbeat.chunkProgress, '/', heartbeat.totalChunks)
      
      // Update last heartbeat time
      setLastHeartbeat(prev => new Map(prev).set(heartbeat.transferId, Date.now()))
      
      // Send heartbeat acknowledgment
      const ackString = `HEARTBEAT_ACK:${heartbeat.transferId}\n`
      sendData(ackString, () => {
        console.log('FileTransfer: Heartbeat acknowledgment sent')
      })
      
    } catch (error) {
      console.error('Failed to parse connection heartbeat:', error)
    }
  }

  // Handle heartbeat acknowledgment
  const handleHeartbeatAcknowledgment = (line: string) => {
    try {
      const transferId = line.replace('HEARTBEAT_ACK:', '')
      console.log('FileTransfer: Received heartbeat acknowledgment for transfer', transferId)
      
      // Find the transfer to check if it's from this device
      const transfer = transfers.find(t => t.transferId === transferId)
      if (!transfer || transfer.direction !== 'sent') {
        console.log('FileTransfer: Ignoring heartbeat acknowledgment for transfer not sent by this device:', transferId)
        return
      }
      
      // Update last heartbeat time
      setLastHeartbeat(prev => new Map(prev).set(transferId, Date.now()))
      
    } catch (error) {
      console.error('Failed to parse heartbeat acknowledgment:', error)
    }
  }

  // Handle transfer completion
  const handleTransferCompletion = (line: string) => {
    try {
      const transferId = line.replace('TRANSFER_COMPLETE:', '')
      console.log('FileTransfer: Received transfer completion for transfer', transferId)
      
      // Find the transfer to check if it's from this device
      const transfer = transfers.find(t => t.transferId === transferId)
      if (!transfer || transfer.direction !== 'sent') {
        console.log('FileTransfer: Ignoring transfer completion for transfer not sent by this device:', transferId)
        return
      }
      
      // Update transfer status to sent (completed)
      setTransfers(prev => prev.map(t => 
        t.transferId === transferId 
          ? { ...t, status: 'sent' as const, progress: 100 }
          : t
      ))
      
      // Clean up heartbeat monitoring
      const existingHeartbeat = heartbeatIntervals.get(transferId)
      if (existingHeartbeat) {
        clearInterval(existingHeartbeat)
        setHeartbeatIntervals(prev => {
          const newMap = new Map(prev)
          newMap.delete(transferId)
          return newMap
        })
      }
      
      // Remove from active transfers
      setActiveTransfers(prev => {
        const newSet = new Set(prev)
        newSet.delete(transferId)
        return newSet
      })
      
      console.log('FileTransfer: Transfer completed successfully')
      
    } catch (error) {
      console.error('Failed to parse transfer completion:', error)
    }
  }

  // Handle transfer pause
  const handleTransferPause = (line: string) => {
    try {
      const transferId = line.replace('PAUSE:', '')
      console.log('FileTransfer: Received pause for transfer', transferId)
      
      // Find the transfer
      const transfer = transfers.find(t => t.transferId === transferId)
      if (!transfer) {
        console.log('FileTransfer: Transfer not found for pause:', transferId)
        return
      }
      
      // Update transfer status based on direction
      const newStatus = transfer.direction === 'sent' ? 'paused_sending' : 'paused_receiving'
      setTransfers(prev => prev.map(t => 
        t.transferId === transferId 
          ? { ...t, status: newStatus as any }
          : t
      ))
      
      // Clear heartbeat monitoring
      const existingHeartbeat = heartbeatIntervals.get(transferId)
      if (existingHeartbeat) {
        clearInterval(existingHeartbeat)
        setHeartbeatIntervals(prev => {
          const newMap = new Map(prev)
          newMap.delete(transferId)
          return newMap
        })
      }
      
      console.log('FileTransfer: Transfer paused')
      
    } catch (error) {
      console.error('Failed to parse transfer pause:', error)
    }
  }

  // Handle resend request
  const handleResendRequest = (line: string) => {
    try {
      const transferId = line.replace('RESEND_REQUEST:', '')
      console.log('FileTransfer: Received resend request for transfer', transferId)
      
      // Find the transfer to check if it's from this device
      const transfer = transfers.find(t => t.transferId === transferId)
      if (!transfer || transfer.direction !== 'sent') {
        console.log('FileTransfer: Ignoring resend request for transfer not sent by this device:', transferId)
        return
      }
      
      // Cancel current transfer and resend
      console.log('FileTransfer: Cancelling current transfer and resending')
      cancelTransfer(transferId)
      
      // Wait a moment then resend
      setTimeout(() => {
        resendTransferRequest(transferId)
      }, 500)
      
    } catch (error) {
      console.error('Failed to parse resend request:', error)
    }
  }

  // Reconstruct file from chunks
  const reconstructFile = async (transferId: string, totalChunks: number) => {
    try {
      const chunks = receivedChunks.get(transferId)
      if (!chunks || chunks.size !== totalChunks) {
        console.error('FileTransfer: Not all chunks received for transfer', transferId)
        return
      }
      
      // Reconstruct file data
      let fileData = ''
      for (let i = 0; i < totalChunks; i++) {
        const chunkData = chunks.get(i)
        if (!chunkData) {
          console.error('FileTransfer: Missing chunk', i, 'for transfer', transferId)
          return
        }
        fileData += chunkData
      }
      
      // Find the transfer to get file info
      const transfer = transfers.find(t => t.transferId === transferId)
      if (!transfer) {
        console.error('FileTransfer: Transfer not found for reconstruction', transferId)
        return
      }
      
      // Create completed transfer
      const completedTransfer: FileTransfer = {
        id: transferId,
        name: transfer.name,
        size: transfer.size,
        type: transfer.type,
        data: fileData,
        status: 'received',
        progress: 100,
        timestamp: Date.now(),
        direction: 'received',
        transferId,
        senderId: transfer.senderId
      }
      
      setTransfers(prev => [...prev, completedTransfer])
      console.log('FileTransfer: File reconstructed and added to transfers list')
      
      // Send final confirmation to sender
      const finalConfirmationString = `TRANSFER_COMPLETE:${transferId}\n`
      sendData(finalConfirmationString, () => {
        console.log('FileTransfer: Final confirmation sent to sender')
      })
      
      // Clean up chunk data
      setReceivedChunks(prev => {
        const newMap = new Map(prev)
        newMap.delete(transferId)
        return newMap
      })
      
    } catch (error) {
      console.error('Failed to reconstruct file:', error)
    }
  }

  // Handle actual file data (legacy - for backward compatibility)
  const handleFileData = (_line: string) => {
    // This is a legacy handler for the old file transfer format
    // The new chunked system should be used instead
    console.log('FileTransfer: Received legacy file data format')
  }

  // Send file transfer request
  const sendFileTransferRequest = async () => {
    if (!selectedFile || !isReady || isTransmitting) return

    // Cancel any existing pending transfers before starting a new one
    const existingPendingTransfers = transfers.filter(t => 
      t.direction === 'sent' && 
      (t.status === 'awaiting_confirmation' || t.status === 'sending')
    )
    
    if (existingPendingTransfers.length > 0) {
      console.log('FileTransfer: Cancelling existing pending transfers before starting new one')
      existingPendingTransfers.forEach(existingTransfer => {
        if (existingTransfer.transferId) {
          cancelTransfer(existingTransfer.transferId)
        }
      })
    }

    console.log('FileTransfer: Starting secure file transfer for:', selectedFile.name, selectedFile.size, 'bytes')
    
    const transferId = Date.now().toString() + Math.random().toString(36).substr(2, 9)
    
    // Calculate chunks
    const fileData = await fileToBase64(selectedFile)
    const chunks = chunkFile(fileData)
    const totalChunks = chunks.length
    
    const request: FileTransferRequest = {
      transferId,
      senderId: deviceId,
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      fileType: selectedFile.type,
      timestamp: Date.now(),
      totalChunks,
      chunkSize: CHUNK_SIZE
    }

    const transfer: FileTransfer = {
      id: transferId,
      name: selectedFile.name,
      size: selectedFile.size,
      type: selectedFile.type,
      data: fileData, // Store the file data in the transfer
      status: 'awaiting_confirmation',
      progress: 0,
      timestamp: Date.now(),
      direction: 'sent',
      transferId,
      senderId: deviceId
    }

    setTransfers(prev => {
      const newTransfers = [...prev, transfer]
      transfersRef.current = newTransfers
      console.log('FileTransfer: Added transfer to array:', transfer.transferId, 'Total transfers:', newTransfers.length)
      return newTransfers
    })
    setActiveTransfers(prev => new Set(prev).add(transferId))

    try {
      // Send transfer request in chunks to avoid frame length limitations
      const requestString = JSON.stringify(request)
      const maxChunkSize = 25 // Conservative size to fit in frame_length: 34
      const requestChunks: string[] = []
      
      for (let i = 0; i < requestString.length; i += maxChunkSize) {
        requestChunks.push(requestString.substring(i, i + maxChunkSize))
      }
      
      console.log('FileTransfer: Sending transfer request in', requestChunks.length, 'chunks')
      
      // Send request chunks sequentially
      let chunkIndex = 0
      const sendNextChunk = () => {
        if (chunkIndex >= requestChunks.length) {
          // All chunks sent, wait for confirmation
          console.log('FileTransfer: All request chunks sent, waiting for confirmation...')
          
          setTransfers(prev => {
            console.log('FileTransfer: Updating transfer status, current transfers:', prev.length)
            const updated = prev.map(t => 
              t.id === transfer.id 
                ? { ...t, status: 'awaiting_confirmation' as const }
                : t
            )
            transfersRef.current = updated
            console.log('FileTransfer: Updated transfers after all chunks sent:', updated.length)
            return updated
          })
          
          // No timeout - wait indefinitely for confirmation
          console.log('FileTransfer: Waiting for confirmation (no timeout)')
          return
        }
        
        const chunk = requestChunks[chunkIndex]
        const isFirstChunk = chunkIndex === 0
        const isLastChunk = chunkIndex === requestChunks.length - 1
        
        // Add chunk markers to help receiver reassemble
        const chunkMarker = isFirstChunk ? 'FTR_START:' : isLastChunk ? 'FTR_END:' : 'FTR_CHUNK:'
        const chunkString = `${chunkMarker}${chunk}\n`
        
        console.log('FileTransfer: Sending request chunk', chunkIndex + 1, 'of', requestChunks.length)
        
        const success = sendData(chunkString, () => {
          console.log('FileTransfer: Request chunk', chunkIndex + 1, 'sent')
          chunkIndex++
          
          // Wait a bit between chunks to avoid overwhelming the receiver
          setTimeout(() => {
            sendNextChunk()
          }, 100)
        })
        
        if (!success) {
          console.error('FileTransfer: Failed to send request chunk', chunkIndex + 1)
          setTransfers(prev => prev.map(t => 
            t.id === transfer.id 
              ? { ...t, status: 'failed', error: 'Failed to send request' }
              : t
          ))
          return
        }
      }
      
      // Start sending chunks
      sendNextChunk()
    } catch (error) {
      console.error('FileTransfer: Error sending transfer request:', error)
      setTransfers(prev => prev.map(t => 
        t.id === transfer.id 
          ? { ...t, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' }
          : t
      ))
    }
  }

  // Send actual file data after confirmation (chunked)
  const sendFileData = async (transferId: string) => {
    console.log('FileTransfer: sendFileData called for transfer:', transferId)
    console.log('FileTransfer: isReady:', isReady)
    console.log('FileTransfer: isTransmitting:', isTransmitting)
    
    if (!isReady || isTransmitting) {
      console.log('FileTransfer: sendFileData blocked - isReady:', isReady, 'isTransmitting:', isTransmitting)
      return
    }

    // Get the transfer to access the file data
    const transfer = transfersRef.current.find(t => t.transferId === transferId)
    if (!transfer || !transfer.data) {
      console.log('FileTransfer: sendFileData blocked - transfer not found or no file data')
      return
    }

    console.log('FileTransfer: Sending file data for transfer:', transferId)
    console.log('FileTransfer: Using file data from transfer, size:', transfer.data.length, 'characters')
    
    const chunks = chunkFile(transfer.data)
    const totalChunks = chunks.length

    console.log('FileTransfer: File chunked, chunks:', totalChunks)
    console.log('FileTransfer: Proceeding with chunk transmission...')

    // Initialize chunk statuses
    const initialStatuses: ChunkStatus[] = chunks.map((_, index) => ({
      chunkIndex: index,
      status: 'pending',
      retryCount: 0
    }))
    
    setChunkStatuses(prev => {
      const newMap = new Map(prev)
      newMap.set(transferId, initialStatuses)
      return newMap
    })

    // Update transfer status to sending
    setTransfers(prev => prev.map(t => 
      t.transferId === transferId 
        ? { ...t, status: 'sending', progress: 0 }
        : t
    ))
    
    // Record transfer start time
    // setTransferStartTimes(prev => new Map(prev).set(transferId, Date.now()))
    
    // Add to active transfers
    setActiveTransfers(prev => new Set(prev).add(transferId))
    
    // Also update the ref immediately for synchronous access
    activeTransfersRef.current.add(transferId)
    console.log('FileTransfer: Added transfer to activeTransfers:', transferId, 'Total active:', activeTransfersRef.current.size)

    // Start heartbeat monitoring
    startHeartbeatMonitoring(transferId, chunks.length)

    // Send chunks one by one
    console.log('FileTransfer: About to call sendChunksSequentially with', chunks.length, 'chunks')
    await sendChunksSequentially(transferId, chunks)
    console.log('FileTransfer: sendChunksSequentially completed')
  }

  // Start heartbeat monitoring for a transfer
  const startHeartbeatMonitoring = (transferId: string, totalChunks: number) => {
    console.log('FileTransfer: Starting heartbeat monitoring for transfer', transferId)
    
    // Set initial heartbeat time
    setLastHeartbeat(prev => new Map(prev).set(transferId, Date.now()))
    
    // Start heartbeat interval (every 5 seconds)
    const heartbeatInterval = setInterval(() => {
      const lastHeartbeatTime = lastHeartbeat.get(transferId) || 0
      const timeSinceLastHeartbeat = Date.now() - lastHeartbeatTime
      
      // If no heartbeat for 15 seconds, consider connection lost
      if (timeSinceLastHeartbeat > 15000) {
        console.log('FileTransfer: Connection lost for transfer', transferId, 'no heartbeat for', timeSinceLastHeartbeat, 'ms')
        
        // Mark transfer as failed due to connection loss
        setTransfers(prev => prev.map(t => 
          t.transferId === transferId 
            ? { ...t, status: 'failed', error: 'Connection lost - no response from receiver' }
            : t
        ))
        
        // Clean up
        clearInterval(heartbeatInterval)
        setHeartbeatIntervals(prev => {
          const newMap = new Map(prev)
          newMap.delete(transferId)
          return newMap
        })
        
        setActiveTransfers(prev => {
          const newSet = new Set(prev)
          newSet.delete(transferId)
          return newSet
        })
        
        // Clear transfer start time
        // setTransferStartTimes(prev => {
        //   const newMap = new Map(prev)
        //   newMap.delete(transferId)
        //   return newMap
        // })
        
        return
      }
      
      // Send heartbeat
      const statuses = chunkStatuses.get(transferId) || []
      const verifiedChunks = statuses.filter(s => s.status === 'verified').length
      
      const heartbeat: ConnectionHeartbeat = {
        transferId,
        senderId: deviceId,
        timestamp: Date.now(),
        chunkProgress: verifiedChunks,
        totalChunks
      }
      
      const heartbeatString = `HEARTBEAT:${JSON.stringify(heartbeat)}\n`
      sendData(heartbeatString, () => {
        console.log('FileTransfer: Heartbeat sent for transfer', transferId, 'progress:', verifiedChunks, '/', totalChunks)
      })
      
    }, 5000) // Send heartbeat every 5 seconds
    
    setHeartbeatIntervals(prev => new Map(prev).set(transferId, heartbeatInterval))
  }

  // Send chunks sequentially with retry logic
  const sendChunksSequentially = async (transferId: string, chunks: string[]) => {
    console.log('FileTransfer: sendChunksSequentially started for transfer:', transferId, 'with', chunks.length, 'chunks')
    console.log('FileTransfer: activeTransfers.has(transferId):', activeTransfersRef.current.has(transferId))
    
    for (let i = 0; i < chunks.length; i++) {
      console.log('FileTransfer: Processing chunk', i + 1, 'of', chunks.length)
      // Check if transfer was cancelled
      if (!activeTransfersRef.current.has(transferId)) {
        console.log('FileTransfer: Transfer cancelled, stopping chunk transmission')
        break
      }
      
      const chunk = chunks[i]
      const checksum = await calculateChecksum(chunk)
      
      const chunkData: FileChunk = {
        transferId,
        chunkIndex: i,
        totalChunks: chunks.length,
        data: chunk,
        checksum,
        senderId: deviceId
      }

      // Update chunk status to sending
      setChunkStatuses(prev => {
        const newMap = new Map(prev)
        const statuses = newMap.get(transferId) || []
        const updatedStatuses = statuses.map(status => 
          status.chunkIndex === i 
            ? { ...status, status: 'sending' as const, lastSentTime: Date.now() }
            : status
        )
        newMap.set(transferId, updatedStatuses)
        return newMap
      })

      // Send chunk and wait for completion
      const chunkString = `CHUNK:${JSON.stringify(chunkData)}\n`
      console.log('FileTransfer: Sending chunk', i, 'of', chunks.length, 'for transfer', transferId)
      
      // Create a promise that resolves when the chunk transmission is complete
      const chunkTransmissionPromise = new Promise<boolean>((resolve) => {
        const success = sendData(chunkString, () => {
          console.log('FileTransfer: Chunk', i, 'transmission completed')
          
          // Update chunk status to sent
          setChunkStatuses(prev => {
            const newMap = new Map(prev)
            const statuses = newMap.get(transferId) || []
            const updatedStatuses = statuses.map(status => 
              status.chunkIndex === i 
                ? { ...status, status: 'sent' as const }
                : status
            )
            newMap.set(transferId, updatedStatuses)
            return newMap
          })
          
          // Update overall progress
          const sentChunks = chunkStatuses.get(transferId)?.filter(s => s.status === 'sent' || s.status === 'verified').length || 0
          const progress = Math.round((sentChunks / chunks.length) * 100)
          
          setTransfers(prev => prev.map(t => 
            t.transferId === transferId 
              ? { ...t, progress }
              : t
          ))
          
          resolve(true)
        })
        
        if (!success) {
          console.error('FileTransfer: Failed to send chunk', i)
          // Mark chunk as failed and retry
          setChunkStatuses(prev => {
            const newMap = new Map(prev)
            const statuses = newMap.get(transferId) || []
            const updatedStatuses = statuses.map(status => 
              status.chunkIndex === i 
                ? { ...status, status: 'failed' as const, retryCount: status.retryCount + 1 }
                : status
            )
            newMap.set(transferId, updatedStatuses)
            return newMap
          })
          
          resolve(false)
        }
      })

      // Wait for this chunk to complete before sending the next one
      const chunkSuccess = await chunkTransmissionPromise
      
      if (!chunkSuccess) {
        console.error('FileTransfer: Chunk transmission failed, stopping')
        break
      }

      // Wait a bit between chunks to avoid overwhelming the receiver
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  // Confirm file transfer request
  const confirmFileTransfer = (request: FileTransferRequest) => {
    console.log('FileTransfer: Confirming file transfer request:', request.transferId)
    
    // Create transfer entry for receiver
    const transfer: FileTransfer = {
      id: request.transferId,
      name: request.fileName,
      size: request.fileSize,
      type: request.fileType,
      data: '',
      status: 'receiving',
      progress: 0,
      timestamp: Date.now(),
      direction: 'received',
      transferId: request.transferId,
      senderId: request.senderId
    }
    
    // Add to transfers
    setTransfers(prev => [...prev, transfer])
    
    // Send confirmation
    const confirmationString = `FTC:${request.transferId}\n`
    sendData(confirmationString, () => {
      console.log('FileTransfer: Confirmation sent')
    })
    
    // Remove from pending requests
    setPendingRequests(prev => prev.filter(r => r.transferId !== request.transferId))
  }

  // Reject file transfer request
  const rejectFileTransfer = (request: FileTransferRequest) => {
    console.log('FileTransfer: Rejecting file transfer request:', request.transferId)
    
    // Send rejection
    const rejectionString = `FTRJ:${request.transferId}\n`
    sendData(rejectionString, () => {
      console.log('FileTransfer: Rejection sent')
    })
    
    // Remove from pending requests
    setPendingRequests(prev => prev.filter(r => r.transferId !== request.transferId))
  }

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        const result = reader.result as string
        resolve(result.split(',')[1]) // Remove data:type;base64, prefix
      }
      reader.onerror = error => reject(error)
    })
  }

  // Download received file
  const downloadFile = (transfer: FileTransfer) => {
    try {
      const byteCharacters = atob(transfer.data)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: transfer.type })
      
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = transfer.name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download file:', error)
    }
  }

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }


  // Request resend from receiver side
  const requestResend = (transferId: string) => {
    console.log('FileTransfer: Requesting resend for transfer', transferId)
    
    // Send resend request to sender
    const resendRequestString = `RESEND_REQUEST:${transferId}\n`
    sendData(resendRequestString, () => {
      console.log('FileTransfer: Resend request sent to sender')
    })
    
    // Cancel current transfer
    cancelTransfer(transferId)
  }

  // Resend transfer request (sender side)
  const resendTransferRequest = async (transferId: string) => {
    const transfer = transfers.find(t => t.transferId === transferId)
    if (!transfer || !transfer.data) return

    console.log('FileTransfer: Resending transfer request for', transferId)
    
    // Cancel current transmission first
    cancelTransfer(transferId)
    
    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Clear any existing timeout
    const existingTimeout = confirmationTimeouts.get(transferId)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }
    
    // Calculate chunks from stored file data
    const chunks = chunkFile(transfer.data)
    const totalChunks = chunks.length
    
    const request: FileTransferRequest = {
      transferId,
      senderId: deviceId,
      fileName: transfer.name,
      fileSize: transfer.size,
      fileType: transfer.type,
      timestamp: Date.now(),
      totalChunks,
      chunkSize: CHUNK_SIZE
    }

    // Update transfer status to awaiting confirmation
    setTransfers(prev => prev.map(t => 
      t.transferId === transferId 
        ? { ...t, status: 'awaiting_confirmation', progress: 0, error: undefined }
        : t
    ))

    try {
      const requestString = `FTR:${JSON.stringify(request)}\n`
      console.log('FileTransfer: Resending transfer request:', requestString)
      
      const success = sendData(requestString, () => {
        console.log('FileTransfer: Transfer request resent, waiting for confirmation...')
      })

      if (success) {
        // No timeout - wait indefinitely for confirmation
        console.log('FileTransfer: Resend request sent, waiting for confirmation (no timeout)')
      } else {
        console.error('FileTransfer: Failed to resend transfer request')
        setTransfers(prev => prev.map(t => 
          t.transferId === transferId 
            ? { ...t, status: 'failed', error: 'Failed to resend request' }
            : t
        ))
      }
    } catch (error) {
      console.error('FileTransfer: Error resending transfer request:', error)
      setTransfers(prev => prev.map(t => 
        t.transferId === transferId 
          ? { ...t, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' }
          : t
      ))
    }
  }

  // Cancel transfer
  const cancelTransfer = (transferId: string) => {
    console.log('FileTransfer: Cancelling transfer', transferId)
    
    // Clear any existing timeout
    const existingTimeout = confirmationTimeouts.get(transferId)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
      setConfirmationTimeouts(prev => {
        const newMap = new Map(prev)
        newMap.delete(transferId)
        return newMap
      })
    }
    
    // Clear any existing heartbeat interval
    const existingHeartbeat = heartbeatIntervals.get(transferId)
    if (existingHeartbeat) {
      clearInterval(existingHeartbeat)
      setHeartbeatIntervals(prev => {
        const newMap = new Map(prev)
        newMap.delete(transferId)
        return newMap
      })
    }
    
    // Send cancellation message
    const cancelString = `CANCEL:${transferId}\n`
    sendData(cancelString, () => {
      console.log('FileTransfer: Cancellation sent')
    })
    
    // Update transfer status to cancelled
    setTransfers(prev => prev.map(t => 
      t.transferId === transferId 
        ? { ...t, status: 'cancelled', error: 'Transfer cancelled by user' }
        : t
    ))
    
    // Remove from active transfers
    setActiveTransfers(prev => {
      const newSet = new Set(prev)
      newSet.delete(transferId)
      return newSet
    })
    
    // Also remove from ref
    activeTransfersRef.current.delete(transferId)
    
    // Clear transfer start time
    // setTransferStartTimes(prev => {
    //   const newMap = new Map(prev)
    //   newMap.delete(transferId)
    //   return newMap
    // })
    
    // Clean up chunk data
    setChunkStatuses(prev => {
      const newMap = new Map(prev)
      newMap.delete(transferId)
      return newMap
    })
    
    setReceivedChunks(prev => {
      const newMap = new Map(prev)
      newMap.delete(transferId)
      return newMap
    })
    
    // Clear selected file if this was the current transfer
    const transfer = transfers.find(t => t.transferId === transferId)
    if (transfer && transfer.direction === 'sent') {
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Pause transfer
  const pauseTransfer = (transferId: string) => {
    console.log('FileTransfer: Pausing transfer', transferId)
    
    const transfer = transfers.find(t => t.transferId === transferId)
    if (!transfer) return
    
    // Send pause message to other device
    const pauseString = `PAUSE:${transferId}\n`
    sendData(pauseString, () => {
      console.log('FileTransfer: Pause message sent')
    })
    
    // Update transfer status based on direction
    const newStatus = transfer.direction === 'sent' ? 'paused_sending' : 'paused_receiving'
    setTransfers(prev => prev.map(t => 
      t.transferId === transferId 
        ? { ...t, status: newStatus as any }
        : t
    ))
    
    // Clear heartbeat monitoring
    const existingHeartbeat = heartbeatIntervals.get(transferId)
    if (existingHeartbeat) {
      clearInterval(existingHeartbeat)
      setHeartbeatIntervals(prev => {
        const newMap = new Map(prev)
        newMap.delete(transferId)
        return newMap
      })
    }
  }

  // Resume transfer
  const resumeTransfer = async (transferId: string) => {
    const transfer = transfers.find(t => t.transferId === transferId)
    if (!transfer || !transfer.data) return

    console.log('FileTransfer: Resuming transfer', transferId)
    
    // Reset chunk statuses and retry
    const chunks = chunkFile(transfer.data)
    
    // Initialize chunk statuses
    const initialStatuses: ChunkStatus[] = chunks.map((_, index) => ({
      chunkIndex: index,
      status: 'pending',
      retryCount: 0
    }))
    
    setChunkStatuses(prev => {
      const newMap = new Map(prev)
      newMap.set(transferId, initialStatuses)
      return newMap
    })

    // Update transfer status
    setTransfers(prev => prev.map(t => 
      t.transferId === transferId 
        ? { ...t, status: 'sending', progress: 0 }
        : t
    ))

    // Resume sending chunks
    await sendChunksSequentially(transferId, chunks)
  }

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sending':
      case 'receiving':
        return <div className="spinner w-4 h-4 border-2"></div>
      case 'sent':
      case 'received':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'awaiting_confirmation':
        return <Clock className="w-4 h-4 text-yellow-500" />
      case 'confirmed':
        return <CheckCircle className="w-4 h-4 text-blue-500" />
      case 'rejected':
        return <X className="w-4 h-4 text-red-500" />
      case 'cancelled':
        return <X className="w-4 h-4 text-orange-500" />
      default:
        return <File className="w-4 h-4" />
    }
  }

  // Keep transfers ref in sync
  useEffect(() => {
    transfersRef.current = transfers
  }, [transfers])

  // Keep activeTransfers ref in sync
  useEffect(() => {
    activeTransfersRef.current = activeTransfers
  }, [activeTransfers])

  // Start receiver when ready
  useEffect(() => {
    if (isReady) {
      console.log('FileTransfer: Starting receiver for file transfers')
      startReceiver(handleReceive)
    }
  }, [isReady, profile])

  // Cleanup timeouts and intervals on unmount
  useEffect(() => {
    return () => {
      confirmationTimeouts.forEach(timeout => clearTimeout(timeout))
      heartbeatIntervals.forEach(interval => clearInterval(interval))
    }
  }, [confirmationTimeouts, heartbeatIntervals])

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

      {/* Device Info & Status */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="p-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span className="text-slate-600">
                <strong>Device:</strong> {deviceId}
              </span>
              <span className="text-slate-600">
                <strong>Profile:</strong> {profile}
              </span>
            </div>
            <div className="text-xs text-slate-500">
              Keep devices close (1-2m) • Same profile required
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* File Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Send File
              <div className="ml-auto flex items-center gap-1">
                <Badge variant="outline" className="text-xs">
                  🔄 Resumable
                </Badge>
                <Badge variant="outline" className="text-xs">
                  ✅ Verified
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden"
                accept="*/*"
              />
              
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="w-full"
                disabled={!isReady || isTransmitting || activeTransfersRef.current.size > 0}
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose File
              </Button>

              {selectedFile && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(selectedFile.size)} • {selectedFile.type}
                      </p>
                      <p className="text-sm text-blue-600 mt-1">
                        ⏱️ Estimated transfer time: {formatDuration(calculateTransferTime(selectedFile.size, profile))}
                      </p>
                      {selectedFile.size > 100000 && (
                        <p className="text-xs text-orange-600 mt-1">
                          ⚠️ Large files may take longer to transfer
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={() => setSelectedFile(null)}
                      variant="ghost"
                      size="sm"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={sendFileTransferRequest}
                  disabled={!selectedFile || !isReady || isTransmitting || activeTransfersRef.current.size > 0}
                  className="flex-1"
                >
                  {isTransmitting ? (
                    <div className="spinner w-4 h-4 border-2 mr-2"></div>
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Send Transfer Request
                </Button>
                {isTransmitting && activeTransfersRef.current.size > 0 && (
                  <Button
                    onClick={() => {
                      // Cancel all active transfers
                      activeTransfersRef.current.forEach(transferId => cancelTransfer(transferId))
                    }}
                    variant="destructive"
                    size="sm"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Cancel All
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-orange-800">
                <AlertCircle className="w-5 h-5" />
                Pending File Transfer Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingRequests.map((request) => (
                  <Card key={request.transferId} className="border-orange-300">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-medium">{request.fileName}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatFileSize(request.fileSize)} • {request.fileType}
                          </p>
                          <p className="text-sm text-blue-600">
                            ⏱️ Estimated transfer time: {formatDuration(calculateTransferTime(request.fileSize, profile))}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            From: {request.senderId}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => confirmFileTransfer(request)}
                          size="sm"
                          className="flex-1"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Accept
                        </Button>
                        <Button
                          onClick={() => rejectFileTransfer(request)}
                          size="sm"
                          variant="destructive"
                          className="flex-1"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Transfer History */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Download className="w-5 h-5" />
              Transfer History
              <div className="ml-auto flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  🔒 Secure
                </Badge>
                {isReady && (
                  <Badge variant="outline" className="text-xs">
                    📡 Listening
                  </Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            {transfers.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                <p className="m-0 text-base">No file transfers yet. Select a file to send or wait for incoming files.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transfers.map((transfer) => (
                  <Card key={transfer.id} className={`${
                    transfer.direction === 'sent' ? 'border-l-4 border-l-blue-400' : 'border-l-4 border-l-green-400'
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(transfer.status)}
                          <span className="font-medium">{transfer.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {formatFileSize(transfer.size)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={transfer.direction === 'sent' ? 'default' : 'secondary'}>
                            {transfer.direction === 'sent' ? 'Sent' : 'Received'}
                          </Badge>
                          {transfer.status === 'received' && (
                            <Button
                              onClick={() => downloadFile(transfer)}
                              size="sm"
                              variant="outline"
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Download
                            </Button>
                          )}
                          {(transfer.status === 'sending' || transfer.status === 'awaiting_confirmation' || transfer.status === 'receiving') && (
                            <div className="flex gap-1">
                              <Button
                                onClick={() => pauseTransfer(transfer.transferId!)}
                                size="sm"
                                variant="outline"
                              >
                                ⏸️ Pause
                              </Button>
                              {transfer.direction === 'sent' ? (
                                <Button
                                  onClick={() => resendTransferRequest(transfer.transferId!)}
                                  size="sm"
                                  variant="outline"
                                >
                                  <RotateCcw className="w-3 h-3 mr-1" />
                                  Send Again
                                </Button>
                              ) : (
                                <Button
                                  onClick={() => requestResend(transfer.transferId!)}
                                  size="sm"
                                  variant="outline"
                                >
                                  <RotateCcw className="w-3 h-3 mr-1" />
                                  Request Resend
                                </Button>
                              )}
                              <Button
                                onClick={() => cancelTransfer(transfer.transferId!)}
                                size="sm"
                                variant="destructive"
                              >
                                <X className="w-3 h-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          )}
                          {(transfer.status === 'paused_sending' || transfer.status === 'paused_receiving') && (
                            <div className="flex gap-1">
                              <Button
                                onClick={() => resumeTransfer(transfer.transferId!)}
                                size="sm"
                                variant="outline"
                              >
                                ▶️ Resume
                              </Button>
                              <Button
                                onClick={() => cancelTransfer(transfer.transferId!)}
                                size="sm"
                                variant="destructive"
                              >
                                <X className="w-3 h-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          )}
                          {transfer.status === 'failed' && transfer.direction === 'sent' && (
                            <Button
                              onClick={() => resendTransferRequest(transfer.transferId!)}
                              size="sm"
                              variant="outline"
                            >
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Send Again
                            </Button>
                          )}
                          {transfer.status === 'awaiting_confirmation' && transfer.direction === 'sent' && (
                            <Button
                              onClick={() => resendTransferRequest(transfer.transferId!)}
                              size="sm"
                              variant="outline"
                            >
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Send Again
                            </Button>
                          )}
                          {(transfer.status === 'failed' || transfer.status === 'awaiting_confirmation') && transfer.direction === 'received' && (
                            <Button
                              onClick={() => requestResend(transfer.transferId!)}
                              size="sm"
                              variant="outline"
                            >
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Request Resend
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {(transfer.status === 'sending' || transfer.status === 'awaiting_confirmation' || transfer.status === 'receiving' || transfer.status === 'paused_sending' || transfer.status === 'paused_receiving') && (
                        <div className="mb-2">
                          <Progress value={transfer.progress} className="h-2" />
                          <div className="flex justify-between items-center mt-1">
                            <p className="text-xs text-muted-foreground">
                              {transfer.status === 'sending' ? 'Sending chunks...' : 
                               transfer.status === 'receiving' ? 'Receiving chunks...' : 
                               transfer.status === 'paused_sending' ? 'Paused (sending)...' :
                               transfer.status === 'paused_receiving' ? 'Paused (receiving)...' :
                               'Awaiting confirmation... (still listening)'} {transfer.progress}%
                            </p>
                            {transfer.status === 'sending' && (
                              <p className="text-xs text-blue-600 font-medium">
                                ⏱️ {calculateTimeRemaining(transfer)} remaining
                              </p>
                            )}
                            {transfer.status === 'receiving' && (
                              <p className="text-xs text-green-600 font-medium">
                                📥 Receiving from {transfer.senderId}
                              </p>
                            )}
                          </div>
                          {transfer.transferId && (
                            <p className="text-xs text-muted-foreground">
                              {transfer.status === 'sending' && chunkStatuses.has(transfer.transferId) ? (
                                <>Chunks: {chunkStatuses.get(transfer.transferId)?.filter(s => s.status === 'verified' || s.status === 'sent').length || 0} / {chunkStatuses.get(transfer.transferId)?.length || 0}</>
                              ) : transfer.status === 'receiving' && receivedChunks.has(transfer.transferId) ? (
                                <>Chunks: {receivedChunks.get(transfer.transferId)?.size || 0} / {transfer.size > 0 ? Math.ceil(transfer.size / CHUNK_SIZE) : '?'}</>
                              ) : null}
                            </p>
                          )}
                        </div>
                      )}
                      
                      {transfer.status === 'failed' && transfer.error && (
                        <Alert className="mb-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-sm">
                            {transfer.error}
                          </AlertDescription>
                          {transfer.direction === 'sent' && (
                            <Button
                              onClick={() => resumeTransfer(transfer.transferId!)}
                              size="sm"
                              variant="outline"
                              className="mt-2"
                            >
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Resume Transfer
                            </Button>
                          )}
                        </Alert>
                      )}
                      
                      <p className="text-xs text-muted-foreground">
                        {new Date(transfer.timestamp).toLocaleTimeString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <LoadingOverlay isVisible={!isReady} />
    </div>
  )
}

export default FileTransferInterface
