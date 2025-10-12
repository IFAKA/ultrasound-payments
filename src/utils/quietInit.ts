// Global Quiet.js initialization utility
// This prevents multiple initializations of Quiet.js which can cause errors

let isQuietInitialized = false
let initPromise: Promise<void> | null = null

// Extend Window interface for Quiet.js
declare global {
  interface Window {
    Quiet: any
    webkitAudioContext: typeof AudioContext
    memoryInitializerPrefixURL?: string
  }
}

// Helper function to load scripts
const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(script)
  })
}

export const initializeQuiet = async (): Promise<void> => {
  // If already initialized, return immediately
  if (isQuietInitialized) {
    return Promise.resolve()
  }

  // If initialization is in progress, return the existing promise
  if (initPromise) {
    return initPromise
  }

  // Start initialization
  initPromise = (async () => {
    try {
      // Load Quiet.js scripts if not already loaded
      if (!window.Quiet) {
        // Set the global variable that Quiet.js expects
        window.memoryInitializerPrefixURL = '/quiet-js/'
        
        // Load quiet.js first
        await loadScript('/quiet-js/quiet.js')
        
        // Now load the emscripten file
        await loadScript('/quiet-js/quiet-emscripten.js')
      }

      // Initialize Quiet.js
      await new Promise<void>((resolve, reject) => {
        window.Quiet.init({
          profilesPrefix: '/quiet-js/',
          memoryInitializerPrefix: '/quiet-js/',
          onReady: () => {
            console.log('Quiet.js initialized successfully')
            isQuietInitialized = true
            resolve()
          },
          onFail: (error: any) => {
            console.error('Quiet.js initialization failed:', error)
            reject(error)
          }
        })
      })
    } catch (error) {
      console.error('Failed to initialize Quiet.js:', error)
      initPromise = null // Reset so we can try again
      throw error
    }
  })()

  return initPromise
}

export const isQuietReady = (): boolean => {
  return isQuietInitialized && !!window.Quiet
}
