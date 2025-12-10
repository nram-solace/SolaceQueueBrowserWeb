import { useState, useEffect } from 'react';

import { useBrokerConfig } from './providers/BrokerConfigProvider';
import { useQueueBrowsing } from './hooks/solace';
import { WINDOW_TITLE } from './config/version';

import DesktopContainer from './components/DesktopContainer';
import RootLayout from './components/RootLayout';
import TreeView from './components/BrokerQueueTreeView';
import MessageList from './components/MessageList';
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

  const [browser, updateBrowser] = useQueueBrowsing();

  useEffect(() => {
    document.title = WINDOW_TITLE;
  }, []);

  const handleSourceSelected = (source) => {
    setSelectedMessage({});
    setSelectedSource(source);
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
            <MessageList 
              sourceDefinition={selectedSource}
              browser={browser}
              selectedMessage={selectedMessage}
              onBrowseFromChange={handleBrowseFromChange}
              onMessageSelect={handleMessageSelect} 
            />
          </RootLayout.CenterPanel>
          <RootLayout.RightPanel1 header="Payload">
            <MessagePayloadView message={selectedMessage} />
          </RootLayout.RightPanel1>
          <RootLayout.RightPanel2 header="Headers">
            <MessageHeadersView message={selectedMessage} />
          </RootLayout.RightPanel2>
          <RootLayout.RightPanel3 header="UserProperties">
            <MessageUserPropertiesView message={selectedMessage} />
          </RootLayout.RightPanel3>
          <RootLayout.RightPanel4 header="Meta">
            <MessageMetaView message={selectedMessage} />
          </RootLayout.RightPanel4>
        </RootLayout>
      </>
  );
}