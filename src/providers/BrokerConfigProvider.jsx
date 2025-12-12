import { createContext, useContext, useEffect, useState } from "react";
import { BaseDirectory } from "@tauri-apps/plugin-fs";
import { fs } from '../utils/tauri/api';

import { useSempApi } from "./SempClientProvider";
import solace from '../utils/solace/solclientasync';
import { encryptSessionData, decryptSessionData, isEncrypted } from '../utils/encryption';

const BrokerConfigContext = createContext(undefined);
const baseDir = BaseDirectory.AppConfig;

export const ConfigSource = {
  FS: {
    name: 'fs',
    readConfig: async () => {
      fs.mkdir('', { baseDir, recursive: true });
      if (await fs.exists('config.json', { baseDir })) {
        const configData = await fs.readTextFile('config.json', { baseDir });
        return JSON.parse(configData);
      } else {
        console.log('no config found');
        return [];
      }
    },
    writeConfig: async (brokers) => {
      await fs.writeTextFile('config.json', JSON.stringify(brokers), { baseDir });
    },
    readSessions: async () => {
      fs.mkdir('', { baseDir, recursive: true });
      if (await fs.exists('sessions.json', { baseDir })) {
        const sessionsData = await fs.readTextFile('sessions.json', { baseDir });
        return JSON.parse(sessionsData);
      } else {
        return {};
      }
    },
    writeSessions: async (sessions) => {
      await fs.writeTextFile('sessions.json', JSON.stringify(sessions), { baseDir });
    }
  },
  LOCAL_STORAGE: (() => {
    // In-memory file handle (lost on page refresh, but works during session)
    // Using closure to persist across method calls
    let fileHandle = null;
    
    return {
      name: 'localStorage',
      readConfig: async () => {
        const configData = window.localStorage.getItem('config');
        return configData ? JSON.parse(configData) : [];
      },
      writeConfig: async (brokers) => {
        window.localStorage.setItem('config', JSON.stringify(brokers));
      },
      readSessions: async () => {
        // Try to read from file system if we have a file handle in memory
        if (fileHandle && 'showOpenFilePicker' in window) {
          try {
            const file = await fileHandle.getFile();
            const contents = await file.text();
            const sessions = JSON.parse(contents);
            
            // Also sync to localStorage as backup
            window.localStorage.setItem('sessions', JSON.stringify(sessions));
            
            return sessions;
          } catch (err) {
            // Handle is invalid, clear it and fall back
            fileHandle = null;
            console.warn('File handle invalid, falling back to localStorage:', err);
          }
        }
        
        // Fallback to localStorage
        const sessionsData = window.localStorage.getItem('sessions');
        return sessionsData ? JSON.parse(sessionsData) : {};
      },
      writeSessions: async (sessions) => {
        // Always save to localStorage - file saving should be an explicit user action
        window.localStorage.setItem('sessions', JSON.stringify(sessions));
        
        // If we have an existing file handle, silently update it (no prompt)
        if (fileHandle && 'showSaveFilePicker' in window) {
          try {
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(sessions, null, 2));
            await writable.close();
            console.log('Sessions updated in file system:', fileHandle.name);
          } catch (err) {
            // Handle is invalid, clear it and continue with localStorage only
            fileHandle = null;
            console.warn('Failed to update sessions file, using localStorage only:', err);
          }
        }
      }
    };
  })()
}

export function BrokerConfigProvider({ source, children }) {
  const [brokers, setBrokers] = useState([]);
  return (
    <BrokerConfigContext.Provider value={{ source, brokers, setBrokers }}>
      {children}
    </BrokerConfigContext.Provider>
  )
}

export function useBrokerConfig() {
  const context = useContext(BrokerConfigContext);
  if (context === undefined) {
    throw new Error('useBrokerConfig must be used within a BrokerConfigProvider');
  }
  const { source, brokers, setBrokers } = context;
  const sempApi = useSempApi();

  useEffect(() => {
    source.readConfig().then(brokers => setBrokers(brokers));
  }, []);

  const saveBroker = (config) => {
    const match = brokers.find(b => b.id === config.id);
    if (match === undefined) {
      config.id = Date.now();
      brokers.push(config);
    } else {
      Object.assign(match, config);
    }
    source.writeConfig(brokers);
    setBrokers([...brokers]);
  };

  const deleteBroker = (config) => {
    const filteredBrokers = brokers.filter(b => b.id !== config.id);
    source.writeConfig(filteredBrokers);
    setBrokers(filteredBrokers);
  };

  const saveSession = async (sessionName) => {
    const sessions = await source.readSessions();
    sessions[sessionName] = {
      name: sessionName,
      brokers: [...brokers],
      savedAt: new Date().toISOString()
    };
    await source.writeSessions(sessions);
    return sessions;
  };

  const saveSessionToFile = async (sessionName, password) => {
    // Check if File System Access API is available
    if (!('showSaveFilePicker' in window)) {
      throw new Error('File System Access API is not supported in this browser. Please use a modern browser like Chrome, Edge, or Opera.');
    }

    if (!password) {
      throw new Error('Password is required for encryption');
    }

    const sessionData = {
      name: sessionName,
      brokers: [...brokers],
      savedAt: new Date().toISOString()
    };

    // Encrypt the session data
    const plaintext = JSON.stringify(sessionData, null, 2);
    const encryptedData = await encryptSessionData(plaintext, password);

    // Prompt user to choose file location
    const fileHandle = await window.showSaveFilePicker({
      suggestedName: `${sessionName || 'session'}.json`,
      types: [{
        description: 'JSON Files',
        accept: { 'application/json': ['.json'] }
      }]
    });

    // Write encrypted session to file
    const writable = await fileHandle.createWritable();
    await writable.write(encryptedData);
    await writable.close();

    // Also save to sessions collection for consistency (unencrypted for local use)
    const sessions = await source.readSessions();
    sessions[sessionName] = sessionData;
    await source.writeSessions(sessions);

    return { fileName: fileHandle.name, sessionData };
  };

  const restoreSession = async (sessionName) => {
    const sessions = await source.readSessions();
    const session = sessions[sessionName];
    if (session && session.brokers) {
      setBrokers([...session.brokers]);
      await source.writeConfig(session.brokers);
      return true;
    }
    return false;
  };

  const restoreSessionFromFile = async (password, fileHandle = null) => {
    // Check if File System Access API is available
    if (!('showOpenFilePicker' in window)) {
      throw new Error('File System Access API is not supported in this browser. Please use a modern browser like Chrome, Edge, or Opera.');
    }

    let file;
    
    // If fileHandle provided, use it; otherwise prompt for file selection
    if (fileHandle) {
      file = await fileHandle.getFile();
    } else {
      const [selectedFileHandle] = await window.showOpenFilePicker({
        types: [{
          description: 'JSON Files',
          accept: { 'application/json': ['.json'] }
        }]
      });
      file = await selectedFileHandle.getFile();
      fileHandle = selectedFileHandle; // Store for potential retry
    }

    // Read the file
    const contents = await file.text();

    // Try to determine if file is encrypted
    let sessionData;
    if (isEncrypted(contents)) {
      // File is encrypted, need password to decrypt
      if (!password) {
        // Throw a specific error that the UI can catch to prompt for password
        const error = new Error('Password is required to decrypt this file');
        error.requiresPassword = true;
        error.fileHandle = fileHandle;
        throw error;
      }
      try {
        const decryptedData = await decryptSessionData(contents, password);
        sessionData = JSON.parse(decryptedData);
      } catch (err) {
        throw new Error('Failed to decrypt file. Incorrect password or corrupted file.');
      }
    } else {
      // File is not encrypted, parse directly
      sessionData = JSON.parse(contents);
    }

    // Validate session data structure
    if (!sessionData.brokers || !Array.isArray(sessionData.brokers)) {
      throw new Error('Invalid session file format. The file must contain a brokers array.');
    }

    // Restore the session
    setBrokers([...sessionData.brokers]);
    await source.writeConfig(sessionData.brokers);

    // Optionally add to sessions collection if it has a name
    if (sessionData.name) {
      const sessions = await source.readSessions();
      sessions[sessionData.name] = {
        ...sessionData,
        savedAt: sessionData.savedAt || new Date().toISOString()
      };
      await source.writeSessions(sessions);
    }

    return { sessionName: sessionData.name || file.name, brokerCount: sessionData.brokers.length };
  };

  const listSessions = async () => {
    const sessions = await source.readSessions();
    return Object.values(sessions).map(s => ({
      name: s.name,
      savedAt: s.savedAt,
      brokerCount: s.brokers?.length || 0
    })).sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
  };

  const deleteSession = async (sessionName) => {
    const sessions = await source.readSessions();
    delete sessions[sessionName];
    await source.writeSessions(sessions);
    return sessions;
  };

  const testBroker = async (config) => {
    // TODO: consider a solace.with(config)
    const { vpn, useTls, hostName, clientPort, clientUsername, clientPassword } = config;

    try {
      const session = solace.SolclientFactory.createAsyncSession({
        url: `${(useTls ? 'wss' : 'ws')}://${hostName}:${clientPort}`,
        vpnName: vpn,
        userName: clientUsername,
        password: clientPassword,
        reconnectRetries: 0,
        connectRetries: 0
      });
      await session.connect();
      session.disconnect();
    } catch (err) {
      console.error('WebSocket connection error details:', {
        message: err.message,
        toString: err.toString(),
        responseCode: err.responseCode,
        info: err.info,
        str: err.str,
        error: err.error,
        fullError: err
      });

      if(err.responseCode) switch(err.responseCode) {
        case 401:
          return { result: { connected: false, replay: false}, message: { severity:'error', summary: 'SMF: Unauthorized', detail: 'Incorrect client username or password.', life: 30000 }};
      }
      
      const errMsg = err.message || err.toString() || err.str || '';
      const errStr = errMsg.toLowerCase();
      const errInfo = err.info || {};
      const errInfoStr = JSON.stringify(errInfo).toLowerCase();

      // Check for certificate/SSL errors in message or info
      const isCertError = errStr.includes('certificate') || 
          errStr.includes('ssl') || 
          errStr.includes('tls') ||
          errStr.includes('cert') ||
          errStr.includes('untrusted') ||
          errStr.includes('invalid certificate') ||
          errStr.includes('certificate verify failed') ||
          errStr.includes('certificate chain') ||
          errStr.includes('self-signed') ||
          errStr.includes('sec_error') ||
          errInfoStr.includes('certificate') ||
          errInfoStr.includes('ssl') ||
          errInfoStr.includes('tls');

      if (isCertError) {
        const brokerUrl = `https://${hostName}:${clientPort}`;
        return { 
          result: { connected: false, replay: false}, 
          message: { 
            severity:'error', 
            summary: 'SMF: Certificate Error', 
            detail: `SSL/TLS certificate validation failed. To accept the certificate:\n\n1. Open this URL in your browser: ${brokerUrl}\n2. If you see a certificate warning, click "Advanced" and then "Proceed" or "Accept the Risk"\n3. This will add the certificate to your browser's trusted store\n4. Try connecting again\n\nNote: WebSocket connections don't show certificate prompts, so you must accept the certificate via a regular HTTPS page first.`, 
            life: 30000 
          }
        };
      }

      if (errMsg.includes('invalid URL')) {
        return { result: { connected: false, replay: false}, message: { severity:'error', summary: 'SMF: Failure', detail: 'Invalid broker URL.', life: 30000 }};
      }
      if (errMsg.includes('Connection error')) {
        // For generic connection errors, check if it might be a certificate issue
        // by checking the browser console for WebSocket errors
        const brokerUrl = `https://${hostName}:${clientPort}`;
        return { 
          result: { connected: false, replay: false}, 
          message: { 
            severity:'error', 
            summary: 'SMF: Connection Error', 
            detail: `Connection failed. This may be a certificate issue. Try:\n\n1. Open ${brokerUrl} in your browser to accept the certificate\n2. Check the browser console (F12) for detailed error messages\n3. Verify the hostname and port are correct`, 
            life: 30000 
          }
        };
      }

      return { result: { connected: false, replay: false}, message: { severity:'error', summary: 'SMF: Connection Error', detail: errMsg || 'Unknown error!', life: 30000 }};    
    }

    const sempClient = sempApi.getClient(config);

    const handleResponse = ({status, body}) => {
      const errorDetail = (
        body?.meta?.error?.description ||
        body?.error ||
        body?.message ||
        (() => {
          if (typeof body === 'string') {
            try {
              const html = document.createElement('html');
              html.innerHTML = body;
              return html.querySelectorAll('center')?.[1]?.innerText;
            } catch {
              return null;
            }
          }
          return null;
        })() ||
        'Unexpected error'
      ) + '.';
      switch (status) {
        case 200:
          if (body?.data && Array.isArray(body.data) && body.data.length > 0) {
            return { result: { connected: true, replay: true}, message: { severity:'success', summary: 'Broker connection successful', detail: 'Broker connection successful.', life: 30000 }};
          } else {
            return { result: { connected: true, replay: false}, message: { severity:'success', summary: 'Broker connection successful', detail: 'Broker connection successful. Note: Replay not enabled. Bi-directional browsing not supported.', life: 30000 }};
          }
        case 400:
          return { result: { connected: false, replay: false}, message: { severity:'error', summary: 'SEMP: Bad Request', detail: errorDetail, life: 30000 }};
        case 401:
          return { result: { connected: false, replay: false}, message: { severity:'error', summary: 'SEMP: Unauthorized', detail: errorDetail, life: 30000 }};
        case 403:
          return { result: { connected: false, replay: false}, message: { severity:'error', summary: 'SEMP: Forbidden', detail: errorDetail, life: 30000 }};
        case 500:
        default:
          // Handle proxy errors and other server errors
          return { result: { connected: false, replay: false}, message: { severity:'error', summary: `SEMP: ${status === 500 ? 'Server Error' : 'Error'}`, detail: errorDetail, life: 30000 }};
      }
    };

    try {
      const { response } = await sempClient.getMsgVpnReplayLogsWithHttpInfo(vpn, { select: ['replayLogName'] });
      return handleResponse(response);
    } catch (err) {
      if(err.status && err.response) {
        return handleResponse(err.response);
      } else {
        console.error(err);
        const errMsg = err.toString();
        const errorData = err.data || err.response?.body || {};
        const isCorsError = errorData?.meta?.error?.corsError || 
                          errMsg.includes('CORS') ||
                          errMsg.includes('Cross-Origin') ||
                          errMsg.includes('NetworkError');
        
        if (isCorsError) {
          const isProduction = !import.meta.env.DEV;
          const origin = isProduction ? window.location.origin : 'your development server';
          return { 
            result: { connected: false, replay: false}, 
            message: { 
              severity:'error', 
              summary: 'SEMP: CORS Error', 
              detail: isProduction 
                ? `Browser blocked the request due to CORS policy. The Solace broker must be configured to allow CORS from: ${origin}. Configure the broker's CORS settings to include this origin in the allowed origins list.`
                : 'Browser blocked the request due to CORS policy. If running in web mode, ensure the Vite dev server proxy is working. Otherwise, run the app through Tauri (npm run tauri dev) to bypass CORS restrictions.',
              life: 30000
            }
          };
        }
        
        if (
          errMsg.includes('Invalid URL') ||
          errMsg.includes('expected empty host')
        ) {
          return { result: { connected: false, replay: false}, message: { severity:'error', summary: 'SEMP: Failure', detail: 'Invalid broker URL.', life: 30000 }};
        }
        
        if (
          errMsg.includes('Network Error') ||
          errMsg.includes('Request has been terminated')
        ) {
          return { result: { connected: false, replay: false}, message: { severity:'error', summary: 'SEMP: Failure', detail: 'Broker service unreachable.', life: 30000 }}
        }
      }
      return { result: { connected: false, replay: false}, message: { severity:'error', summary: 'SEMP: Failure', detail: 'Unknown error!', life: 30000 }};
    }
  };

  return {
    brokers,
    brokerEditor: {
      save: saveBroker,
      delete: deleteBroker,
      test: testBroker
    },
    sessionManager: {
      save: saveSession,
      saveToFile: saveSessionToFile,
      restore: restoreSession,
      restoreFromFile: restoreSessionFromFile,
      list: listSessions,
      delete: deleteSession
    }
  };
}