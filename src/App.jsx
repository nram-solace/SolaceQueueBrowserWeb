import { useState, useEffect } from 'react';

import { useBrokerConfig } from './providers/BrokerConfigProvider';
import { useQueueBrowsing } from './hooks/solace';
import { WINDOW_TITLE } from './config/version';

import DesktopContainer from './components/DesktopContainer';
import RootLayout from './components/RootLayout';
import TitleBar from './components/TitleBar';
import TreeView from './components/BrokerQueueTreeView';
import MessageList from './components/MessageList';
import WelcomeScreen from './components/WelcomeScreen';
import MessagePayloadView from './components/MessagePayloadView';
import MessageHeadersView from './components/MessageHeadersView';
import MessageUserPropertiesView from './components/MessageUserPropertiesView';
import MessageMetaView from './components/MessageMetaView';

import 'primeflex/primeflex.css';
import 'primeicons/primeicons.css';
import './App.css';

export default function App() {
  const { brokers, brokerEditor, sessionManager } = useBrokerConfig();
  
  const [selectedSource, setSelectedSource] = useState({});
  const [selectedMessage, setSelectedMessage] = useState({});
  const [hasEverSelectedSource, setHasEverSelectedSource] = useState(false);
  const [payloadHeaderTemplate, setPayloadHeaderTemplate] = useState(null);

  const [browser, updateBrowser] = useQueueBrowsing();

  useEffect(() => {
    document.title = WINDOW_TITLE;
  }, []);

  const handleSourceSelected = (source) => {
    setSelectedMessage({});
    setSelectedSource(source);
    // Track if we've ever had a queue/topic selected (has sourceName)
    // Once set to true, it stays true even when source is cleared (broker switch)
    if (source && source.sourceName) {
      setHasEverSelectedSource(true);
    }
  };

  const handleBrowseFromChange = (browseFrom) => {
    updateBrowser(selectedSource, browseFrom);
  };

  const handleMessageSelect = (message) => {
    setSelectedMessage(message);
  };

  return (
    window.location.pathname === '/desktop' ?
      <DesktopContainer /> :
      <>
        <RootLayout>
          <RootLayout.LeftPanel>
            <TreeView brokers={brokers} brokerEditor={brokerEditor} sessionManager={sessionManager} onSourceSelected={handleSourceSelected} />
          </RootLayout.LeftPanel>
          <RootLayout.CenterPanel>
            {selectedSource.sourceName ? (
              <MessageList 
                sourceDefinition={selectedSource}
                browser={browser}
                selectedMessage={selectedMessage}
                onBrowseFromChange={handleBrowseFromChange}
                onMessageSelect={handleMessageSelect} 
              />
            ) : hasEverSelectedSource ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '1.1rem', color: 'var(--text-color-secondary)' }}>
                Select a connected broker and a Queue to view messages
              </div>
            ) : (
              <WelcomeScreen />
            )}
          </RootLayout.CenterPanel>
          <RootLayout.RightPanel1 headerTemplate={payloadHeaderTemplate}>
            <MessagePayloadView 
              message={selectedMessage} 
              onHeaderTemplate={setPayloadHeaderTemplate}
            />
          </RootLayout.RightPanel1>
          <RootLayout.RightPanel2>
            <MessageHeadersView message={selectedMessage} />
          </RootLayout.RightPanel2>
          <RootLayout.RightPanel3>
            <MessageUserPropertiesView message={selectedMessage} />
          </RootLayout.RightPanel3>
          <RootLayout.RightPanel4>
            <MessageMetaView message={selectedMessage} />
          </RootLayout.RightPanel4>
        </RootLayout>
      </>
  );
}