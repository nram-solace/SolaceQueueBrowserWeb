// Import Tauri v2 plugins
import * as fsPlugin from '@tauri-apps/plugin-fs';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

console.log('🔧 Tauri API Module Loaded - Using Tauri v2 HTTP Plugin');
console.log('🔧 Tauri fetch:', typeof tauriFetch, tauriFetch);

// Export for compatibility
export const fs = fsPlugin;
export const http = {
  fetch: tauriFetch
};