import { useState, useRef, useEffect } from 'react';
import { useSempApi } from '../../providers/SempClientProvider';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { InputText } from 'primereact/inputtext';
import { Dialog } from 'primereact/dialog';
import { Splitter, SplitterPanel } from 'primereact/splitter';
import { Dropdown } from 'primereact/dropdown';

import { Tree } from 'primereact/tree';

import ContentPanel from '../ContentPanel';
import BrokerConfigDialog from '../BrokerConfigDialog';
import ReplayTopicDialog from '../ReplayTopicDialog';
import SessionManagerDialog from '../SessionManagerDialog';
import PasswordInputDialog from '../PasswordInputDialog';
import SettingsDialog from '../SettingsDialog';

import { TopicIcon, LvqIcon, QueueIcon } from '../../icons';
import { APP_TITLE } from '../../config/version';
import { getAllMsgVpnQueues } from '../../utils/solace/semp/paging';
import { useSettings } from '../../providers/SettingsProvider';
import { getTheme, DEFAULT_THEME } from '../../config/themes';
import PropTypes from 'prop-types';

import classes from './styles.module.css';

// Small brand icon - different shapes per brand
function BrandIcon({ theme }) {
  const primaryColor = theme?.primary || '#00C895';
  const brand = theme?.brand || 'teal';
  const style = { marginRight: '0.5rem', verticalAlign: 'middle' };
  
  switch (brand) {
    case 'lime':
      // Diamond
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" style={style}>
          <polygon points="8,1 15,8 8,15 1,8" fill={primaryColor} />
        </svg>
      );
    case 'ruby':
      // Hexagon
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" style={style}>
          <polygon points="4,2 12,2 15,8 12,14 4,14 1,8" fill={primaryColor} />
        </svg>
      );
    case 'violet':
      // Pentagon
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" style={style}>
          <polygon points="8,1 15,6 13,14 3,14 1,6" fill={primaryColor} />
        </svg>
      );
    case 'silver':
      // Rounded square
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" style={style}>
          <rect x="2" y="2" width="12" height="12" rx="3" fill={primaryColor} />
        </svg>
      );
    case 'amber':
      // Triangle
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" style={style}>
          <polygon points="8,2 15,14 1,14" fill={primaryColor} />
        </svg>
      );
    case 'sapphire':
      // Star
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" style={style}>
          <polygon points="8,1 9.5,6 15,6 10.5,9.5 12,15 8,11.5 4,15 5.5,9.5 1,6 6.5,6" fill={primaryColor} />
        </svg>
      );
    case 'teal':
    default:
      // Circle
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" style={style}>
          <circle cx="8" cy="8" r="7" fill={primaryColor} />
        </svg>
      );
  }
}

export default function TreeView({ brokers, brokerEditor, sessionManager, onSourceSelected }) {
  const { settings } = useSettings();
  const currentTheme = getTheme(settings.selectedTheme || DEFAULT_THEME);
  
  const [brokerForConfig, setBrokerForConfig] = useState(null);
  const [brokerAndReplayTopic, setBrokerAndReplayTopic] = useState(null);
  const [showSessionManager, setShowSessionManager] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const toast = useRef(null);
  const loadQueuesTokenRef = useRef(0);

  const [queuesListMap, setQueuesListMap] = useState({});
  const [topicsListMap, setTopicsListMap] = useState({});
  const [selectedBroker, setSelectedBroker] = useState(null);
  const [selectedQueueId, setSelectedQueueId] = useState(null);
  const [queueSearchTerm, setQueueSearchTerm] = useState('');
  const [groupBy, setGroupBy] = useState(null); // null, 'environment', 'region', or 'type'
  const [queueFilter, setQueueFilter] = useState('all'); // 'all' or 'non-empty'

  const sempApi = useSempApi();

  const getBrokerIcon = (testResult) => (
    testResult ? (
      testResult.connected ? (
        testResult.replay ?
          'pi pi-circle-fill text-primary' :
          'pi pi-circle text-primary'
      ) :
        'pi pi-times-circle text-red-500'
    ) : 'pi pi-question-circle'
  );

  const getQueueIcon = (queue) => {
    const isLvq = queue.maxMsgSpoolUsage === 0;
    const isEmpty = queue.msgSpoolUsage === 0;
    const isFull = (queue.msgSpoolUsage / queue.maxMsgSpoolUsage) > queue.eventMsgSpoolUsageThreshold.setPercent;

    const iconColor = isEmpty ? '' : (!isLvq && isFull) ? 'text-red-500' : 'text-primary';
    return isLvq ?
      <LvqIcon size="16" className={iconColor} /> :
      <QueueIcon size="16" className={iconColor} />;
  };

  const buildQueueNodeList = (config, queues) => {
    return queues
      .filter((queue) => !queue.queueName.startsWith('#'))
      .map((queue, n) => ({
        id: `${config.id}/queue/${n}`,
        key: `queue/${n}`,
        label: queue.queueName,
        data: {
          type: config.testResult.replay ? 'queue' : 'basic',
          toolIcon: '',
          config,
          sourceName: queue.queueName,
          msgSpoolUsage: queue.msgSpoolUsage || 0
        },
        icon: getQueueIcon(queue)
      }));
  };

  const refreshQueuesForBroker = async (config, showToast = true) => {
    if (!config.testResult?.connected) {
      if (showToast) {
        toast.current?.show({
          severity: 'warn',
          summary: 'Warning',
          detail: `Broker "${config.displayName}" is not connected`
        });
      }
      return false;
    }

    try {
      const sempClient = sempApi.getClient(config);
      // Note: some brokers reject multi-attribute `select` lists (400 INVALID_PARAMETER),
      // so we intentionally avoid `select` here for maximum compatibility.
      const queues = await getAllMsgVpnQueues(sempClient, config.vpn);
      const queueNodeList = buildQueueNodeList(config, queues);
      setQueuesListMap(prev => ({ ...prev, [config.id]: queueNodeList }));
      if (showToast) {
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: `Queues refreshed for "${config.displayName}"`
        });
      }
      return true;
    } catch (err) {
      console.error('Failed to refresh queues:', err);
      if (showToast) {
        const errorDetail = err.response?.body?.meta?.error?.description || 
                           err.message || 
                           'Failed to refresh queues';
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: errorDetail
        });
      }
      return false;
    }
  };

  const handleRefreshBrokerQueues = async (config) => {
    setIsLoading(true);
    try {
      await refreshQueuesForBroker(config, true);
    } finally {
      setIsLoading(false);
    }
  };

  // Format broker label as "Name - VPN"
  const formatBrokerLabel = (config) => {
    // Try to parse from displayName (format: "name:vpn")
    if (config.displayName && config.displayName.includes(':')) {
      const parts = config.displayName.split(':');
      if (parts.length >= 2) {
        return `${parts[0]} - ${parts[1]}`;
      }
    }
    // Fallback: use name and vpn fields if available
    if (config.name && config.vpn) {
      return `${config.name} - ${config.vpn}`;
    }
    // Last resort: return displayName as-is
    return config.displayName || '';
  };

  // Build broker nodes with optional grouping
  const buildBrokerNodes = () => {
    // Only group if groupBy is explicitly 'environment', 'region', or 'type'
    // Everything else (null, undefined, empty string, etc.) means no grouping
    if (groupBy !== 'environment' && groupBy !== 'region' && groupBy !== 'type') {
      // No grouping: return flat list
      return brokers.map(config => ({
        id: config.id,
        key: config.id,
        label: formatBrokerLabel(config),
        data: {
          type: 'broker',
          config
        },
        icon: getBrokerIcon(config.testResult),
        leaf: true
      }));
    }

    // Group by environment or type
    const grouped = {};
    brokers.forEach(config => {
      const groupKey = config[groupBy] || 'Unknown';
      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
      }
      grouped[groupKey].push(config);
    });

    // Build tree structure with group nodes
    const groupNodes = Object.keys(grouped).sort().map(groupKey => {
      const groupBrokers = grouped[groupKey];
      return {
        id: `group-${groupBy}-${groupKey}`,
        key: `group-${groupBy}-${groupKey}`,
        label: `${groupKey} (${groupBrokers.length})`,
        icon: 'pi pi-folder',
        data: {
          type: 'group'
        },
        children: groupBrokers.map(config => ({
          id: config.id,
          key: config.id,
          label: formatBrokerLabel(config),
          data: {
            type: 'broker',
            config
          },
          icon: getBrokerIcon(config.testResult),
          leaf: true
        }))
      };
    });

    return groupNodes;
  };

  const brokerNodes = buildBrokerNodes();

  const buildTopicNodeList = (config) => {
    const { replayTopics = [] } = config;
    return replayTopics
      .map((replayTopic, n) => ({
        id: `${config.id}/topic/${n}`,
        key: `topic/${n}`,
        label: replayTopic.subscriptionName,
        icon: <TopicIcon />,
        data: {
          type: 'topic',
          toolIcon: 'pi pi-ellipsis-h',
          onToolClick: () => setBrokerAndReplayTopic({ broker: config, replayTopic }),
          config,
          sourceName: replayTopic.subscriptionName,
          topics: replayTopic.topics
        }
      }));
  }

  const handleExpand = async (event) => {
    // No longer needed since brokers are leaf nodes
  };

  const handleSelect = async (event) => {
    const { node } = event;
    const { type, config } = node.data || {};

    // Ignore group nodes
    if (type === 'group') {
      return;
    }

    if (type === 'broker') {
      const loadToken = ++loadQueuesTokenRef.current;
      // Reset selected queue, search term, and filter when switching brokers
      setSelectedQueueId(null);
      setQueueSearchTerm('');
      setQueueFilter('all');
      
      // Clear the selected source to reset the message list when switching brokers
      onSourceSelected?.({});
      
      // Always set the selected broker first, so it can be edited even if connection test fails
      setSelectedBroker(config);
      
      // Test connection and load queues when broker is selected
      setIsLoading(true);
      try {
        const { result } = await brokerEditor.test(config);
        Object.assign(config, { testResult: result });
        
        if (result.connected) {
          // Load queues for selected broker
          const sempClient = sempApi.getClient(config);
          // Note: some brokers reject multi-attribute `select` lists (400 INVALID_PARAMETER),
          // so we intentionally avoid `select` here for maximum compatibility.
          const queues = await getAllMsgVpnQueues(sempClient, config.vpn);
          const queueNodeList = buildQueueNodeList(config, queues);
          if (loadToken === loadQueuesTokenRef.current) {
            setQueuesListMap(prev => ({ ...prev, [config.id]: queueNodeList }));
          }
          
          // Load topics if replay mode
          if (result.replay) {
            const topicNodeList = buildTopicNodeList(config);
            if (loadToken === loadQueuesTokenRef.current) {
              setTopicsListMap(prev => ({ ...prev, [config.id]: topicNodeList }));
            }
          }
        }
      } catch (err) {
        // If test fails, still mark it as not connected but keep broker selected
        console.error('Broker connection test failed:', err);
        Object.assign(config, { testResult: { connected: false, replay: false } });
      } finally {
        if (loadToken === loadQueuesTokenRef.current) {
          setIsLoading(false);
        }
      }
      return;
    }

    // Handle queue/topic selection
    if (event.node.data.type === 'queue' || event.node.data.type === 'topic' || event.node.data.type === 'basic') {
      onSourceSelected?.(event.node.data);
    }
  };

  const handleAddBrokerClick = () => {
    setBrokerForConfig({});
  };

  const handleSessionManagerClick = () => {
    setShowSessionManager(true);
  };

  const handleSessionManagerHide = () => {
    setShowSessionManager(false);
  };

  const handleSaveClick = () => {
    setSessionName('');
    setShowSaveDialog(true);
  };

  const handleSaveSession = async () => {
    if (!sessionName.trim()) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Validation',
        detail: 'Please enter a session name'
      });
      return;
    }

    setIsLoading(true);
    try {
      await sessionManager.save(sessionName.trim());
      toast.current?.show({
        severity: 'success',
        summary: 'Success',
        detail: `Session "${sessionName.trim()}" saved successfully`
      });
      setShowSaveDialog(false);
      setSessionName('');
    } catch (err) {
      console.error('Failed to save session:', err);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to save session'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSessionToFile = async () => {
    if (!sessionName.trim()) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Validation',
        detail: 'Please enter a session name'
      });
      return;
    }

    // Show password dialog for encryption
    setShowPasswordDialog(true);
  };

  const handleSaveSessionToFileWithPassword = async (password) => {
    setShowPasswordDialog(false);
    setIsLoading(true);
    try {
      const result = await sessionManager.saveToFile(sessionName.trim(), password);
      toast.current?.show({
        severity: 'success',
        summary: 'Success',
        detail: `Session "${sessionName.trim()}" saved to encrypted file: ${result.fileName}`
      });
      setShowSaveDialog(false);
      setSessionName('');
    } catch (err) {
      console.error('Failed to save session to file:', err);
      if (err.name === 'AbortError') {
        // User cancelled file picker - don't show error
        return;
      }
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: err.message || 'Failed to save session to file'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreClick = () => {
    setShowSessionManager(true);
  };

  const handleRefreshClick = async () => {
    if (!selectedBroker) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Warning',
        detail: 'Please select a broker to refresh'
      });
      return;
    }
    await handleRefreshBrokerQueues(selectedBroker);
  };

  const handleEditClick = () => {
    if (!selectedBroker) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Warning',
        detail: 'Please select a broker to edit'
      });
      return;
    }
    setBrokerForConfig(selectedBroker);
  };

  const handleConfigHide = (data) => {
    setBrokerForConfig(null);
  };

  const handleTopicDialogHide = (data) => {
    const { broker } = brokerAndReplayTopic;
    const topicNodeList = buildTopicNodeList(broker);
    setTopicsListMap(prev => ({ ...prev, [broker.id]: topicNodeList }));
    setBrokerAndReplayTopic(null);
  };

  const nodeTemplate = (node, options) => {
    return (
      <div className={`${options.className} ${classes.treeNodeLabel}`}>
        <div style={{ flex: '1', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.label}</div>
      </div>
    );
  };

  // Get queues and topics for selected broker
  const selectedBrokerQueues = selectedBroker ? queuesListMap[selectedBroker.id] || [] : [];
  const selectedBrokerTopics = selectedBroker ? topicsListMap[selectedBroker.id] || [] : [];
  const queueCountText = (n) => `${n} queue${n === 1 ? '' : 's'}`;

  // Only show queue search when there are queues/topics to search for
  const showQueueSearch =
    !!selectedBroker &&
    !!selectedBroker.testResult?.connected &&
    (selectedBrokerQueues.length > 0 || selectedBrokerTopics.length > 0);

  // If the selected broker has no queues/topics, clear any stale search term
  useEffect(() => {
    if (!showQueueSearch && queueSearchTerm) {
      setQueueSearchTerm('');
    }
  }, [showQueueSearch, queueSearchTerm]);

  // Filter queues based on search term and empty/non-empty filter
  const filteredQueues = selectedBrokerQueues
    .filter(queue => {
      // Apply empty/non-empty filter
      if (queueFilter === 'non-empty') {
        const msgSpoolUsage = queue.data?.msgSpoolUsage ?? 0;
        if (msgSpoolUsage === 0) {
          return false;
        }
      }
      // Apply search term filter
      if (queueSearchTerm) {
        return queue.label.toLowerCase().includes(queueSearchTerm.toLowerCase());
      }
      return true;
    });

  const filteredTopics = queueSearchTerm
    ? selectedBrokerTopics.filter(topic => 
        topic.label.toLowerCase().includes(queueSearchTerm.toLowerCase())
      )
    : selectedBrokerTopics;

  const handleQueueSearch = () => {
    // Search is performed in real-time via filteredQueues/filteredTopics
    // This handler can be used for additional search logic if needed
  };

  const handleClearSearch = () => {
    setQueueSearchTerm('');
  };

  const handleQueueSelect = (queueNode) => {
    setSelectedQueueId(queueNode.id);
    onSourceSelected?.(queueNode.data);
  };

  const handleTopicSelect = (topicNode) => {
    setSelectedQueueId(topicNode.id);
    onSourceSelected?.(topicNode.data);
  };

  return (
    <div className={classes.threePanelContainer}>
      <Toast ref={toast} />
      
      {/* Top Panel: Logo Text */}
      <div className={classes.topPanel}>
        <div className={classes.logoText}>
          <BrandIcon theme={currentTheme} />
          {APP_TITLE}
        </div>
      </div>

      {/* Resizable Splitter for Broker List and Queue List */}
      <Splitter layout="vertical" className={classes.resizableSplitter}>
        {/* Middle Panel: Buttons + Broker List */}
        <SplitterPanel size={40} minSize={15} className={classes.splitterPanel}>
          <div className={classes.middlePanel}>
            <div className={classes.buttonRow}>
              <Button 
                icon="pi pi-plus" 
                text 
                size="small"
                onClick={handleAddBrokerClick} 
                tooltip="Add Broker"
                tooltipOptions={{ position: 'bottom' }}
                aria-label="Add Broker"
              />
              <Button 
                icon="pi pi-save" 
                text 
                size="small"
                onClick={handleSaveClick} 
                tooltip="Save Session"
                tooltipOptions={{ position: 'bottom' }}
                aria-label="Save Session"
              />
              <Button 
                icon="pi pi-undo" 
                text 
                size="small"
                onClick={handleRestoreClick} 
                tooltip="Restore Session"
                tooltipOptions={{ position: 'bottom' }}
                aria-label="Restore Session"
              />
              <Button 
                icon="pi pi-pencil" 
                text 
                size="small"
                onClick={handleEditClick} 
                tooltip="Edit Broker"
                tooltipOptions={{ position: 'bottom' }}
                aria-label="Edit Broker"
                disabled={!selectedBroker}
              />
              <Button 
                icon="pi pi-cog" 
                text 
                size="small"
                onClick={() => setShowSettingsDialog(true)} 
                tooltip="Settings"
                tooltipOptions={{ position: 'bottom' }}
                aria-label="Settings"
              />
            </div>
            {brokers.length > 0 && (
              <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.12)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label htmlFor="groupBy" style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>Group By</label>
                <Dropdown
                  id="groupBy"
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.value)}
                  options={[
                    { label: 'None', value: null },
                    { label: 'Environment', value: 'environment' },
                    { label: 'Region/DC', value: 'region' },
                    { label: 'Type', value: 'type' }
                  ]}
                  optionLabel="label"
                  optionValue="value"
                  placeholder="None"
                  style={{ flex: 1, maxWidth: '200px' }}
                  size="small"
                />
              </div>
            )}
            <div className={classes.brokerListContainer}>
              {brokers.length > 0 && (
                <Tree 
                  value={brokerNodes} 
                  className={classes.tree} 
                  nodeTemplate={nodeTemplate} 
                  selectionMode="single" 
                  loading={isLoading}
                  onSelect={handleSelect}
                  pt={{ container: { className: classes.treeContainer }, label: { className: classes.treeNodeLabel } }}
                />
              )}
            </div>
          </div>
        </SplitterPanel>

        {/* Bottom Panel: Queue List */}
        <SplitterPanel size={60} minSize={30} className={classes.splitterPanel}>
          <div className={classes.bottomPanel}>
            {selectedBroker && (
              <div className={classes.queueListHeader}>
                <div>
                  <div className={classes.queueListHeaderTitle}>
                    <strong>{formatBrokerLabel(selectedBroker)}</strong>
                  </div>
                  <div className={classes.queueListHeaderSubtitle}>
                    <div className={classes.queueFilterRow}>
                      <span>{queueCountText(filteredQueues.length)}</span>
                      <div className={classes.queueFilterButtons}>
                        <button
                          onClick={() => setQueueFilter('non-empty')}
                          className={queueFilter === 'non-empty' ? classes.queueFilterActive : classes.queueFilterButton}
                        >
                          Non-Empty
                        </button>
                        <span className={classes.queueFilterSeparator}>|</span>
                        <button
                          onClick={() => setQueueFilter('all')}
                          className={queueFilter === 'all' ? classes.queueFilterActive : classes.queueFilterButton}
                        >
                          All
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {showQueueSearch && (
              <div className={classes.queueSearchContainer}>
                <Button 
                  icon="pi pi-refresh" 
                  text 
                  size="small"
                  onClick={handleRefreshClick} 
                  tooltip="Refresh Queues"
                  tooltipOptions={{ position: 'bottom' }}
                  aria-label="Refresh Queues"
                  disabled={!selectedBroker}
                  className={classes.queueRefreshButton}
                />
                <InputText
                  value={queueSearchTerm}
                  onChange={(e) => setQueueSearchTerm(e.target.value)}
                  placeholder="Search queues..."
                  className={classes.queueSearchInput}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      handleClearSearch();
                    }
                  }}
                />
                <Button
                  icon={queueSearchTerm ? "pi pi-times" : "pi pi-search"}
                  text
                  size="small"
                  onClick={queueSearchTerm ? handleClearSearch : handleQueueSearch}
                  tooltip={queueSearchTerm ? "Clear search" : "Search"}
                  tooltipOptions={{ position: 'bottom' }}
                  aria-label={queueSearchTerm ? "Clear search" : "Search"}
                  className={classes.queueSearchButton}
                />
              </div>
            )}
            <div className={classes.queueListContainer}>
              {selectedBroker ? (
                selectedBroker.testResult?.connected ? (
                  filteredQueues.length > 0 || filteredTopics.length > 0 ? (
                    <>
                      {filteredQueues.map((queueNode) => (
                        <div
                          key={queueNode.id}
                          className={`${classes.queueItem} ${selectedQueueId === queueNode.id ? classes.queueItemSelected : ''}`}
                          onClick={() => handleQueueSelect(queueNode)}
                        >
                          <span className={classes.queueIcon}>{queueNode.icon}</span>
                          <span className={classes.queueLabel}>{queueNode.label}</span>
                        </div>
                      ))}
                      {selectedBroker.testResult?.replay && filteredTopics.length > 0 && (
                        <>
                          <div className={classes.queueListHeader}>
                            <strong>Replay Log</strong>
                          </div>
                          {filteredTopics.map((topicNode) => (
                            <div
                              key={topicNode.id}
                              className={`${classes.queueItem} ${selectedQueueId === topicNode.id ? classes.queueItemSelected : ''}`}
                              onClick={() => handleTopicSelect(topicNode)}
                            >
                              <span className={classes.queueIcon}>{topicNode.icon}</span>
                              <span className={classes.queueLabel}>{topicNode.label}</span>
                            </div>
                          ))}
                        </>
                      )}
                      {queueSearchTerm && filteredQueues.length === 0 && filteredTopics.length === 0 && (
                        <div className={classes.emptyMessage}>No queues match "{queueSearchTerm}"</div>
                      )}
                    </>
                  ) : (
                    <div className={classes.emptyMessage}>No queues available</div>
                  )
                ) : (
                  <div className={classes.emptyMessage}>Broker not connected</div>
                )
              ) : (
                <div className={classes.emptyMessage}>Select a broker to view queues</div>
              )}
            </div>
          </div>
        </SplitterPanel>
      </Splitter>

      <BrokerConfigDialog config={brokerForConfig} brokerEditor={brokerEditor} onHide={handleConfigHide} />
      <ReplayTopicDialog config={brokerAndReplayTopic} brokerEditor={brokerEditor} onHide={handleTopicDialogHide} />
      <SessionManagerDialog 
        sessionManager={sessionManager} 
        visible={showSessionManager} 
        onHide={handleSessionManagerHide} 
      />
      <PasswordInputDialog
        visible={showPasswordDialog}
        onHide={() => setShowPasswordDialog(false)}
        onConfirm={handleSaveSessionToFileWithPassword}
        title="Set Encryption Password"
        message="You will need this password to restore the session."
        requireConfirm={true}
        confirmLabel="Save"
      />
      <SettingsDialog
        visible={showSettingsDialog}
        onHide={() => setShowSettingsDialog(false)}
      />
      <Dialog
        header="Save Session"
        visible={showSaveDialog}
        onHide={() => setShowSaveDialog(false)}
        style={{ width: '450px' }}
        footer={
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button label="Cancel" outlined onClick={() => setShowSaveDialog(false)} />
            <Button 
              label="Save to File" 
              icon="pi pi-file"
              outlined
              onClick={handleSaveSessionToFile} 
              loading={isLoading}
              tooltip="Save to local file system"
              tooltipOptions={{ position: 'top' }}
            />
            <Button 
              label="Save" 
              icon="pi pi-save"
              onClick={handleSaveSession} 
              loading={isLoading}
              tooltip="Save to browser storage"
              tooltipOptions={{ position: 'top' }}
            />
          </div>
        }
      >
        <div style={{ padding: '1rem 0' }}>
          <label htmlFor="sessionName" style={{ display: 'block', marginBottom: '0.5rem' }}>Session Name</label>
          <InputText
            id="sessionName"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSaveSession();
              }
            }}
            style={{ width: '100%' }}
            autoFocus
          />
          <small style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-color-secondary)' }}>
            Choose "Save" to store in browser or "Save to File" to save to your local file system
          </small>
        </div>
      </Dialog>
    </div>
  );
}

TreeView.propTypes = {
  brokers: PropTypes.arrayOf(PropTypes.object).isRequired,
  brokerEditor: PropTypes.object.isRequired,
  sessionManager: PropTypes.object.isRequired,
  onSourceSelected: PropTypes.func.isRequired
};