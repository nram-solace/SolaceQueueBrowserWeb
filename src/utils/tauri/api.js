// Detect if running in Tauri environment
const isTauri = typeof window !== 'undefined' && 
  (window.__TAURI__ !== undefined || window.top?.__TAURI__ !== undefined || 
   window.__TAURI_INTERNALS__ !== undefined);

// Import Tauri v2 plugins
import * as fsPlugin from '@tauri-apps/plugin-fs';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

// Create a wrapper fetch that falls back to browser fetch if Tauri fails
const createFetch = () => {
  const browserFetch = window.fetch.bind(window);
  
  // Check if Tauri internals are actually available
  const tauriAvailable = isTauri && 
    typeof window.__TAURI_INTERNALS__ !== 'undefined' &&
    window.__TAURI_INTERNALS__ !== null;
  
  if (tauriAvailable) {
    console.log('🔧 Tauri HTTP Plugin available');
  } else {
    // Only log in development - this is expected in browser environments
    if (import.meta.env.DEV) {
      console.debug('🌐 Using browser fetch API (Tauri not available - CORS may block cross-origin requests)');
    }
  }
  
  // Return a wrapper function that tries Tauri first, falls back to browser
  return async (url, options) => {
    // Only try Tauri if internals are actually available
    if (tauriAvailable) {
      try {
        return await tauriFetch(url, options);
      } catch (err) {
        // If Tauri fetch fails, fall back to browser fetch
        console.warn('⚠️ Tauri fetch failed, falling back to browser fetch:', err.message);
        return browserFetch(url, options);
      }
    }
    
    // Use browser fetch (will have CORS limitations for cross-origin requests)
    return browserFetch(url, options);
  };
};

// Export for compatibility
export const fs = fsPlugin;
export const http = {
  fetch: createFetch()
};