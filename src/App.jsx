import { useState, useEffect } from 'react';

import { useBrokerConfig } from './providers/BrokerConfigProvider';
import { useQueueBrowsing } from './hooks/solace';
import { WINDOW_TITLE } from './config/version';

import DesktopContainer from './components/DesktopContainer';
import RootLayout from './components/RootLayout';
import TreeView from './components/BrokerQueueTreeView';
import MessageList from './components/MessageList';
import MessagePayloadView from './components/MessagePayloadView';
import MessageHeaderView from './components/MessageHeaderView';

import 'primeflex/primeflex.css';
import 'primeicons/primeicons.css';
import './App.css';

export default function App() {
  const { brokers, brokerEditor } = useBrokerConfig();
  
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
            <TreeView brokers={brokers} brokerEditor={brokerEditor} onSourceSelected={handleSourceSelected} />
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
          <RootLayout.RightTopPanel header="Payload">
            <MessagePayloadView message={selectedMessage} />
          </RootLayout.RightTopPanel>
          <RootLayout.RightBottomPanel header="Headers">
            <MessageHeaderView message={selectedMessage} />
          </RootLayout.RightBottomPanel>
        </RootLayout>
      </>
  );
}