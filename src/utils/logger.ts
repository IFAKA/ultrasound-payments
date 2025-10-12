// 🎨 Creative Console Logger for Ultrasound Payments
// Provides beautifully formatted, colorized, and emoji-rich console logs
// Updated with all required methods for comprehensive logging

type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'debug'
type LogCategory = 'payment' | 'text' | 'chat' | 'system' | 'audio' | 'merchant' | 'customer'

interface LogConfig {
  level: LogLevel
  category: LogCategory
  message: string
  data?: any
  timestamp?: boolean
}

// 🎨 Color schemes for different log levels
const colors = {
  info: '#4A90E2',      // Blue
  success: '#7ED321',   // Green
  warning: '#F5A623',   // Orange
  error: '#D0021B',     // Red
  debug: '#9013FE',     // Purple
  reset: '#FFFFFF'      // White
}

// 🎭 Emojis for different categories
const categoryEmojis = {
  payment: '💳',
  text: '📝',
  chat: '💬',
  system: '⚙️',
  audio: '🎵',
  merchant: '🏪',
  customer: '👤'
}

// 🎪 Styled console methods
const createStyledLog = (config: LogConfig) => {
  const { level, category, message, data, timestamp = true } = config
  
  const emoji = categoryEmojis[category] || '📋'
  const color = colors[level]
  const time = timestamp ? new Date().toLocaleTimeString() : ''
  
  // Create beautiful header
  const header = `%c${emoji} ${category.toUpperCase()} ${level.toUpperCase()}`
  const headerStyle = `
    background: linear-gradient(135deg, ${color}, ${color}88);
    color: white;
    padding: 4px 12px;
    border-radius: 8px;
    font-weight: bold;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-right: 8px;
  `
  
  // Create timestamp
  const timeStr = timestamp ? `%c[${time}]` : ''
  const timeStyle = `
    color: #666;
    font-size: 10px;
    font-family: monospace;
  `
  
  // Create message
  const messageStr = `%c${message}`
  const messageStyle = `
    color: #333;
    font-size: 13px;
    font-weight: 500;
  `
  
  // Combine all parts
  const parts = [header, timeStr, messageStr].filter(Boolean)
  const styles = [headerStyle, timeStyle, messageStyle].filter(Boolean)
  
  return { parts, styles, data }
}

// 🎯 Main logger function
export const logger = {
  info: (category: LogCategory, message: string, data?: any) => {
    const { parts, styles, data: logData } = createStyledLog({
      level: 'info',
      category,
      message,
      data
    })
    console.log(parts.join(' '), ...styles, logData || '')
  },
  
  success: (category: LogCategory, message: string, data?: any) => {
    const { parts, styles, data: logData } = createStyledLog({
      level: 'success',
      category,
      message,
      data
    })
    console.log(parts.join(' '), ...styles, logData || '')
  },
  
  warning: (category: LogCategory, message: string, data?: any) => {
    const { parts, styles, data: logData } = createStyledLog({
      level: 'warning',
      category,
      message,
      data
    })
    console.warn(parts.join(' '), ...styles, logData || '')
  },
  
  error: (category: LogCategory, message: string, data?: any) => {
    const { parts, styles, data: logData } = createStyledLog({
      level: 'error',
      category,
      message,
      data
    })
    console.error(parts.join(' '), ...styles, logData || '')
  },
  
  debug: (category: LogCategory, message: string, data?: any) => {
    const { parts, styles, data: logData } = createStyledLog({
      level: 'debug',
      category,
      message,
      data
    })
    console.log(parts.join(' '), ...styles, logData || '')
  }
}

// 🎪 Specialized loggers for different components
export const paymentLogger = {
  merchant: {
    rx: (message: string, data?: any) => logger.info('merchant', `📥 Received: ${message}`, data),
    tx: (message: string, data?: any) => logger.success('merchant', `📤 Transmitted: ${message}`, data),
    state: (state: string, data?: any) => logger.debug('merchant', `🔄 State: ${state}`, data),
    error: (message: string, data?: any) => logger.error('merchant', `❌ Error: ${message}`, data),
    success: (message: string, data?: any) => logger.success('merchant', `✅ Success: ${message}`, data),
    warning: (message: string, data?: any) => logger.warning('merchant', `⚠️ Warning: ${message}`, data),
    debug: (message: string, data?: any) => logger.debug('merchant', `🔍 Debug: ${message}`, data)
  },
  
  customer: {
    rx: (message: string, data?: any) => logger.info('customer', `📥 Received: ${message}`, data),
    tx: (message: string, data?: any) => logger.success('customer', `📤 Transmitted: ${message}`, data),
    state: (state: string, data?: any) => logger.debug('customer', `🔄 State: ${state}`, data),
    error: (message: string, data?: any) => logger.error('customer', `❌ Error: ${message}`, data),
    success: (message: string, data?: any) => logger.success('customer', `✅ Success: ${message}`, data),
    warning: (message: string, data?: any) => logger.warning('customer', `⚠️ Warning: ${message}`, data),
    debug: (message: string, data?: any) => logger.debug('customer', `🔍 Debug: ${message}`, data)
  },
  
  system: {
    init: (message: string, data?: any) => logger.info('system', `🚀 Initializing: ${message}`, data),
    ready: (message: string, data?: any) => logger.success('system', `✨ Ready: ${message}`, data),
    effect: (message: string, data?: any) => logger.debug('system', `⚡ Effect: ${message}`, data),
    cleanup: (message: string, data?: any) => logger.info('system', `🧹 Cleanup: ${message}`, data),
    error: (message: string, data?: any) => logger.error('system', `❌ Error: ${message}`, data)
  }
}

export const textLogger = {
  rx: (message: string, data?: any) => logger.info('text', `📥 Received: ${message}`, data),
  tx: (message: string, data?: any) => logger.success('text', `📤 Transmitted: ${message}`, data),
  error: (message: string, data?: any) => logger.error('text', `❌ Error: ${message}`, data),
  success: (message: string, data?: any) => logger.success('text', `✅ Success: ${message}`, data)
}

export const chatLogger = {
  rx: (message: string, data?: any) => logger.info('chat', `📥 Received: ${message}`, data),
  tx: (message: string, data?: any) => logger.success('chat', `📤 Transmitted: ${message}`, data),
  error: (message: string, data?: any) => logger.error('chat', `❌ Error: ${message}`, data),
  success: (message: string, data?: any) => logger.success('chat', `✅ Success: ${message}`, data)
}

export const audioLogger = {
  freq: (freq: string, data?: any) => logger.debug('audio', `🎵 Frequency: ${freq}`, data),
  level: (level: number, data?: any) => logger.debug('audio', `🔊 Audio Level: ${level}%`, data),
  error: (message: string, data?: any) => logger.warning('audio', `⚠️ Audio Issue: ${message}`, data),
  init: (message: string, data?: any) => logger.info('audio', `🎤 Audio Init: ${message}`, data)
}

// 🎭 Message deduplication logger
export const seenLogger = {
  duplicate: (message: string, timeAgo: number) => 
    logger.debug('system', `🔄 Duplicate message ignored: ${message} (${timeAgo}ms ago)`),
  new: (message: string) => 
    logger.debug('system', `✨ New message: ${message}`)
}

export default logger
