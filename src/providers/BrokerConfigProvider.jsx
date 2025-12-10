import { createContext, useContext, useEffect, useState } from "react";
import { BaseDirectory } from "@tauri-apps/plugin-fs";
import { fs } from '../utils/tauri/api';

import { useSempApi } from "./SempClientProvider";
import solace from '../utils/solace/solclientasync';

const BrokerConfigContext = createContext();
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
        // Try to write to file system if File System Access API is available
        if ('showSaveFilePicker' in window) {
          try {
            // If we don't have a file handle, prompt user to choose location
            if (!fileHandle) {
              const lastFileName = window.localStorage.getItem('sessionsFileName') || 'sessions.json';
              
              fileHandle = await window.showSaveFilePicker({
                suggestedName: lastFileName,
                types: [{
                  description: 'JSON Files',
                  accept: { 'application/json': ['.json'] }
                }]
              });
              
              // Remember the file name
              window.localStorage.setItem('sessionsFileName', fileHandle.name);
            }
            
            // Write to file
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(sessions, null, 2));
            await writable.close();
            
            // Also save to localStorage as backup
            window.localStorage.setItem('sessions', JSON.stringify(sessions));
            
            console.log('Sessions saved to file system:', fileHandle.name);
            return;
          } catch (err) {
            // User cancelled or error occurred
            if (err.name === 'AbortError') {
              // User cancelled - clear handle so they can choose again next time
              fileHandle = null;
              throw err; // Re-throw so caller knows user cancelled
            } else {
              // Other error - clear handle and fall back to localStorage
              fileHandle = null;
              console.warn('Failed to save sessions to file system, using localStorage:', err);
            }
          }
        }
        
        // Fallback to localStorage
        window.localStorage.setItem('sessions', JSON.stringify(sessions));
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
  const { source, brokers, setBrokers } = useContext(BrokerConfigContext);
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
      console.error(err);

      if(err.responseCode) switch(err.responseCode) {
        case 401:
          return { result: { connected: false, replay: false}, message: { severity:'error', summary: 'SMF: Unauthorized', detail: 'Incorrect client username or password.' }};
      }
      
      const errMsg = err.message;

      if (errMsg.includes('invalid URL')) {
        return { result: { connected: false, replay: false}, message: { severity:'error', summary: 'SMF: Failure', detail: 'Invalid broker URL.'}};
      }
      if (errMsg.includes('Connection error')) {
        return { result: { connected: false, replay: false}, message: { severity:'error', summary: 'SMF: Failure', detail: 'General connection error.'}};
      }

      return { result: { connected: false, replay: false}, message: { severity:'error', summary: 'SMF: Connection Error', detail: 'Unknown error!' }};    
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
            return { result: { connected: true, replay: true}, message: { severity:'info', summary: 'Success', detail: 'Broker connection succeeded.' }};
          } else {
            return { result: { connected: true, replay: false}, message: { severity:'warn', summary: 'Warning', detail: 'Replay Log not enabled on broker.' }};
          }
        case 400:
          return { result: { connected: false, replay: false}, message: { severity:'error', summary: 'SEMP: Bad Request', detail: errorDetail }};
        case 401:
          return { result: { connected: false, replay: false}, message: { severity:'error', summary: 'SEMP: Unauthorized', detail: errorDetail }};
        case 403:
          return { result: { connected: false, replay: false}, message: { severity:'error', summary: 'SEMP: Forbidden', detail: errorDetail }};
        case 500:
        default:
          // Handle proxy errors and other server errors
          return { result: { connected: false, replay: false}, message: { severity:'error', summary: `SEMP: ${status === 500 ? 'Server Error' : 'Error'}`, detail: errorDetail }};
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
                : 'Browser blocked the request due to CORS policy. If running in web mode, ensure the Vite dev server proxy is working. Otherwise, run the app through Tauri (npm run tauri dev) to bypass CORS restrictions.'
            }
          };
        }
        
        if (
          errMsg.includes('Invalid URL') ||
          errMsg.includes('expected empty host')
        ) {
          return { result: { connected: false, replay: false}, message: { severity:'error', summary: 'SEMP: Failure', detail: 'Invalid broker URL.' }};
        }
        
        if (
          errMsg.includes('Network Error') ||
          errMsg.includes('Request has been terminated')
        ) {
          return { result: { connected: false, replay: false}, message: { severity:'error', summary: 'SEMP: Failure', detail: 'Broker service unreachable.' }}
        }
      }
      return { result: { connected: false, replay: false}, message: { severity:'error', summary: 'SEMP: Failure', detail: 'Unknown error!' }};
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
      restore: restoreSession,
      list: listSessions,
      delete: deleteSession
    }
  };
}