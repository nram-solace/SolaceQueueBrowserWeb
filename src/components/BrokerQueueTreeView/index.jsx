import { useState, useRef } from 'react';
import { useSempApi } from '../../providers/SempClientProvider';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { InputText } from 'primereact/inputtext';
import { Dialog } from 'primereact/dialog';

import { Tree } from 'primereact/tree';

import ContentPanel from '../ContentPanel';
import BrokerConfigDialog from '../BrokerConfigDialog';
import ReplayTopicDialog from '../ReplayTopicDialog';
import SessionManagerDialog from '../SessionManagerDialog';

import { TopicIcon, LvqIcon, QueueIcon } from '../../icons';
import { APP_TITLE } from '../../config/version';

import classes from './styles.module.css';

export default function TreeView({ brokers, brokerEditor, sessionManager, onSourceSelected }) {
  const [brokerForConfig, setBrokerForConfig] = useState(null);
  const [brokerAndReplayTopic, setBrokerAndReplayTopic] = useState(null);
  const [showSessionManager, setShowSessionManager] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const toast = useRef(null);

  const [queuesListMap, setQueuesListMap] = useState({});
  const [topicsListMap, setTopicsListMap] = useState({});

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
          sourceName: queue.queueName
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
      const { data: queues } = await sempApi.getClient(config).getMsgVpnQueues(config.vpn, { count: 100 });
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

  const nodes = [...brokers.map(config => ({
    id: config.id,
    key: config.id,
    label: config.displayName,
    data: {
      type: 'broker',
      toolIcon: 'pi pi-ellipsis-h',
      onToolClick: () => setBrokerForConfig(config),
      refreshIcon: 'pi pi-refresh',
      onRefreshClick: () => handleRefreshBrokerQueues(config),
      config
    },
    icon: getBrokerIcon(config.testResult),
    leaf: false,
    children: [
      {
        id: `${config.id}/queues`,
        key: `${config.id}/queues`,
        label: 'Queues',
        icon: <QueueIcon size="16" />,
        data: {
          type: 'queues',
          toolIcon: '',
          config
        },
        leaf: false,
        children: queuesListMap[config.id] || []
      },
      ...(config.testResult?.replay ? [{
        id: `${config.id}/topics`,
        key: `${config.id}/topics`,
        label: 'Replay Log',
        icon: 'pi pi-backward',
        data: {
          type: 'topics',
          toolIcon: 'pi pi-plus',
          onToolClick: () => { setBrokerAndReplayTopic({ broker: config, replayTopic: null }) },
          config
        },
        leaf: false,
        children: topicsListMap[config.id] || []
      }] : [])
    ]
  })),
  ];

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
    const { node } = event;
    const { type, config } = node.data;

    if (type === 'broker') {
      setIsLoading(true);
      const { result } = await brokerEditor.test(config);
      Object.assign(config, { testResult: result }); //HACK: this updates the during each expansion
      setIsLoading(false);
      return;
    }

    if (type === 'queues' && config.testResult.connected) {
      setIsLoading(true);
      const { data: queues } = await sempApi.getClient(config).getMsgVpnQueues(config.vpn, { count: 100 });
      const queueNodeList = buildQueueNodeList(config, queues);
      setQueuesListMap(prev => ({ ...prev, [config.id]: queueNodeList }));
      setIsLoading(false);
    }

    if (type === 'topics' && config.testResult.connected) {
      const topicNodeList = buildTopicNodeList(config);
      setTopicsListMap(prev => ({ ...prev, [config.id]: topicNodeList }));
    }
  };

  const handleSelect = (event) => {
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

  const handleRestoreClick = () => {
    setShowSessionManager(true);
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
    const handleToolClick = (evt) => {
      evt.stopPropagation();
      node.data.onToolClick && node.data.onToolClick();
    };
    const handleRefreshClick = (evt) => {
      evt.stopPropagation();
      node.data.onRefreshClick && node.data.onRefreshClick();
    };
    return (
      <div className={`${options.className} ${classes.treeNodeLabel}`}>
        <div style={{ flex: '1' }}>{node.label}</div>
        {node.data.onRefreshClick && (
          <i 
            className={`${node.data.refreshIcon} ${classes.toolIcon} ${classes.refreshIcon}`} 
            onClick={handleRefreshClick}
            title="Refresh queues"
          />
        )}
        {node.data.toolIcon && (
          <i className={`${node.data.toolIcon} ${classes.toolIcon}`} onClick={handleToolClick} />
        )}
      </div>
    );
  };

  return (
    <ContentPanel 
      title="Event Brokers" 
      headerPrefix={<div className={classes.versionHeader}>{APP_TITLE}</div>}
    >
      <Toast ref={toast} />
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
      </div>
      <div className={classes.container}>
        <Tree value={nodes} className={classes.tree} nodeTemplate={nodeTemplate} selectionMode="single" loading={isLoading}
          onExpand={handleExpand} onSelect={handleSelect}
          pt={{ container: { className: classes.treeContainer }, label: { className: classes.treeNodeLabel } }}
        />
        <BrokerConfigDialog config={brokerForConfig} brokerEditor={brokerEditor} onHide={handleConfigHide} />
        <ReplayTopicDialog config={brokerAndReplayTopic} brokerEditor={brokerEditor} onHide={handleTopicDialogHide} />
        <SessionManagerDialog 
          sessionManager={sessionManager} 
          visible={showSessionManager} 
          onHide={handleSessionManagerHide} 
        />
        <Dialog
          header="Save Session"
          visible={showSaveDialog}
          onHide={() => setShowSaveDialog(false)}
          style={{ width: '400px' }}
          footer={
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <Button label="Cancel" outlined onClick={() => setShowSaveDialog(false)} />
              <Button label="Save" onClick={handleSaveSession} loading={isLoading} />
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
          </div>
        </Dialog>
      </div>
    </ContentPanel>
  );
}