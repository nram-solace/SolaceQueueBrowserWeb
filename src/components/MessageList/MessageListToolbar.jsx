import { useEffect, useState } from 'react';

import { Button } from 'primereact/button';
import { Calendar } from 'primereact/calendar';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Toolbar } from 'primereact/toolbar';
import { confirmDialog } from 'primereact/confirmdialog';

import { SOURCE_TYPE, BROWSE_MODE, SUPPORTED_BROWSE_MODES, MESSAGE_ORDER } from '../../hooks/solace';
import { useSempApi } from '../../providers/SempClientProvider';

import classes from './styles.module.css';

export default function MessageListToolbar({ sourceDefinition, minTime, maxTime, onChange }) {
  const { type: sourceType, sourceName, config } = sourceDefinition;
  const { id: brokerId } = config || {};

  const sempApi = useSempApi();
  const [messageCount, setMessageCount] = useState(null);
  const [queueDetails, setQueueDetails] = useState(null);

  const [sourceLabel, browseModes] =
    (sourceType === SOURCE_TYPE.BASIC) ? [
      'Queue', [
        { value: BROWSE_MODE.BASIC, name: 'Default' }
      ]
    ] : (sourceType === SOURCE_TYPE.QUEUE) ? [
      'Queue', [
        { value: BROWSE_MODE.BASIC, name: 'Default' },
        { value: BROWSE_MODE.HEAD, name: 'Oldest First' },
        { value: BROWSE_MODE.TAIL, name: 'Newest First' },
        { value: BROWSE_MODE.TIME, name: 'Date / Time' },
        { value: BROWSE_MODE.MSGID, name: 'Message ID' }
      ]] : (sourceType === SOURCE_TYPE.TOPIC) ? [
        'Topic', [
          { value: BROWSE_MODE.TIME, name: 'Date / Time' },
          { value: BROWSE_MODE.MSGID, name: 'Message ID' }
        ]
      ] : [
      '', [
        { value: null }
      ]
    ];

  const [minDate, maxDate] = [new Date(minTime * 1000), new Date(maxTime * 1000)];

  const [browseMode, setBrowseMode] = useState(BROWSE_MODE.BASIC);
  const [calendarVisible, setCalendarVisible] = useState(false);

  // Browse Start Points
  const [dateTime, setDateTime] = useState(null);
  const [msgId, setMsgId] = useState('');

  const basicSource = (sourceType === SOURCE_TYPE.BASIC);

  const getFromTime = () => {
    if (!dateTime) {
      return ({ fromTime: null });
    }
    try {
      // dateTime from Calendar component is already a Date object
      const fromTime = dateTime instanceof Date ? 
        Math.floor(dateTime.getTime() / 1000) : 
        Math.floor(Date.parse(dateTime) / 1000);
      return ({ fromTime });
    } catch {
      console.error('Invalid date format'); //TODO: send toast notification
      return ({ fromTime: null });
    }
  }

  const getFromMsgId = () => {
    if (!msgId || msgId.trim() === '') {
      return ({ fromTime: null });
    }
    try {
      const fromMsgId = msgId.startsWith('rmid1:') ?
        window.parseInt(msgId.substring(24).replace('-', ''), 16) :
        window.parseInt(msgId);
      return ((fromMsgId > 0) ? { fromMsgId } : { fromTime: null });
    } catch {
      console.error('Invalid message id'); //TODO: send toast notification
      return ({ fromTime: null });
    }
  }

  useEffect(() => {
    // Reset to Default when source changes
    setBrowseMode(BROWSE_MODE.BASIC);
    // trigger a refresh automatically when source has changed
    raiseOnChange(BROWSE_MODE.BASIC);
  }, [brokerId, sourceType, sourceName]);

  // Fetch queue message count and details when a queue is selected
  useEffect(() => {
    const fetchQueueDetails = async () => {
      // Only fetch for queue types (QUEUE or BASIC)
      if ((sourceType === SOURCE_TYPE.QUEUE || sourceType === SOURCE_TYPE.BASIC) && config && sourceName) {
        try {
          const response = await sempApi.getClient(config).getMsgVpnQueue(config.vpn, sourceName);
          // The current message count is in collections.msgs.count
          const count = response.collections?.msgs?.count ?? null;
          setMessageCount(count);
          
          // Store queue details for the second line
          if (response.data) {
            setQueueDetails(response.data);
          } else {
            setQueueDetails(null);
          }
        } catch (err) {
          console.error('Error fetching queue details:', err);
          setMessageCount(null);
          setQueueDetails(null);
        }
      } else {
        setMessageCount(null);
        setQueueDetails(null);
      }
    };

    fetchQueueDetails();
  }, [sourceType, sourceName, config, sempApi]);

  useEffect(() => {
    // Trigger refresh when browse mode changes, but skip TIME and MSGID modes
    // (they need user input first, will be triggered by Refresh button or input changes)
    if (browseMode !== BROWSE_MODE.TIME && browseMode !== BROWSE_MODE.MSGID) {
      raiseOnChange(browseMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browseMode]);

  const raiseOnChange = (browseMode) => {
    // For BASIC source type, always use BASIC mode
    if (basicSource) {
      onChange({ browseMode: BROWSE_MODE.BASIC });
      return;
    }

    // Handle different browse modes
    switch (browseMode) {
      case BROWSE_MODE.BASIC:
        onChange({ browseMode: BROWSE_MODE.BASIC });
        break;
      case BROWSE_MODE.HEAD:
        onChange({ browseMode, startFrom: { queuePosition: MESSAGE_ORDER.OLDEST } });
        break;
      case BROWSE_MODE.TAIL:
        onChange({ browseMode, startFrom: { queuePosition: MESSAGE_ORDER.NEWEST } });
        break;
      case BROWSE_MODE.TIME:
        const timeStartFrom = getFromTime();
        if (timeStartFrom.fromTime === null) {
          // No date selected yet, don't trigger browse
          return;
        }
        onChange({ browseMode, startFrom: timeStartFrom });
        break;
      case BROWSE_MODE.MSGID:
        const msgIdStartFrom = getFromMsgId();
        if (msgIdStartFrom.fromTime === null && !msgIdStartFrom.fromMsgId) {
          // No valid message ID provided yet, don't trigger browse
          return;
        }
        onChange({ browseMode, startFrom: msgIdStartFrom });
        break;
    }
  };

  const isReplayBasedMode = (mode) => {
    return mode === BROWSE_MODE.HEAD || 
           mode === BROWSE_MODE.TAIL || 
           mode === BROWSE_MODE.TIME || 
           mode === BROWSE_MODE.MSGID;
  };

  const handleBrowseModeChange = ({ value: mode }) => {
    // If selecting a replay-based mode, show confirmation dialog
    if (isReplayBasedMode(mode)) {
      confirmDialog({
        message: 'This sort order needs Replay and temporary queues to work. Do you want to proceed?',
        header: 'Replay-Based Browsing Required',
        icon: 'pi pi-info-circle',
        accept: () => {
          setBrowseMode(mode);
        },
        reject: () => {
          // Fall back to Default (BASIC mode)
          setBrowseMode(BROWSE_MODE.BASIC);
        }
      });
    } else {
      // Default - no confirmation needed
      setBrowseMode(mode);
    }
  };

  const handleCalendarVisibleChangle = async () => {
    if (calendarVisible) {
      setCalendarVisible(false);
    } else {
      setCalendarVisible(true);
    }
  };

  const handleCalendarChange = (e) => {
    setDateTime(e.value);
    // If TIME mode is active and a date is selected, trigger refresh
    if (browseMode === BROWSE_MODE.TIME && e.value) {
      setTimeout(() => raiseOnChange(browseMode), 0);
    }
  };

  const handleMsgIdTextChange = (e) => {
    setMsgId(e.target.value);
    // Don't auto-refresh on every keystroke, wait for user to click Refresh or press Enter
  }

  const handleRefreshClick = () => {
    raiseOnChange(browseMode);
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0';
    return num.toLocaleString('en-US');
  };

  const formatMegabytes = (mb) => {
    if (mb === null || mb === undefined || mb === 0) return '0 MB';
    if (mb < 1000) {
      return `${mb.toFixed(2)} MB`;
    }
    // Convert to GB if >= 1000 MB
    return `${(mb / 1000).toFixed(2)} GB`;
  };

  const calculateUtilization = (msgSpoolUsage, maxMsgSpoolUsage) => {
    // msgSpoolUsage is in bytes (B), maxMsgSpoolUsage is in megabytes (MB)
    if (!msgSpoolUsage || !maxMsgSpoolUsage || maxMsgSpoolUsage === 0) return '0';
    // Convert msgSpoolUsage from bytes to MB using 1000, then calculate percentage
    const msgSpoolUsageMB = msgSpoolUsage / (1000 * 1000);
    const percent = (msgSpoolUsageMB / maxMsgSpoolUsage) * 100;
    return percent.toFixed(1);
  };

  const displayTitle = () => {
    if (!queueDetails || (sourceType !== SOURCE_TYPE.QUEUE && sourceType !== SOURCE_TYPE.BASIC)) {
      return `${sourceLabel}: ${sourceName}`;
    }

    // Build suffix: PQ if partitions > 0, LVQ if size == 0
    const suffixes = [];
    const partitions = queueDetails.partitionCount ?? 0;
    const maxSpoolUsage = queueDetails.maxMsgSpoolUsage ?? 0;
    
    if (partitions > 0) {
      suffixes.push('PQ');
    }
    if (maxSpoolUsage === 0) {
      suffixes.push('LVQ');
    }
    
    const suffix = suffixes.length > 0 ? ` (${suffixes.join('|')})` : '';
    return `${sourceLabel}: ${sourceName}${suffix}`;
  };

  const displayDetails = () => {
    if (!queueDetails || (sourceType !== SOURCE_TYPE.QUEUE && sourceType !== SOURCE_TYPE.BASIC)) {
      return null;
    }

    const count = messageCount ?? 0;
    const spoolSize = queueDetails.maxMsgSpoolUsage ?? 0; // maxMsgSpoolUsage is in MB
    const utilization = calculateUtilization(queueDetails.msgSpoolUsage, queueDetails.maxMsgSpoolUsage);
    const owner = queueDetails.owner || 'N/A';
    const permission = queueDetails.permission || 'N/A';
    const accessType = queueDetails.accessType || 'N/A';
    const partitions = queueDetails.partitionCount ?? 0;

    return `${formatNumber(count)} messages | Size: ${formatMegabytes(spoolSize)} | Utilization: ${utilization}% | Owner: ${owner} | Permission: ${permission} | Type: ${accessType} | Partitions: ${partitions}`;
  };

  return (
    <Toolbar className={classes.messageListToolbar}
      start={() => (
        <div>
          <h3>{displayTitle()}</h3>
          {queueDetails && (sourceType === SOURCE_TYPE.QUEUE || sourceType === SOURCE_TYPE.BASIC) && (
            <div style={{ fontSize: '0.875rem', color: 'var(--text-color-secondary)', marginTop: '0.25rem' }}>
              {displayDetails()}
            </div>
          )}
        </div>
      )}
      end={() =>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label>Sort Order:</label>
          <Dropdown value={browseMode} onChange={handleBrowseModeChange} options={browseModes} optionLabel="name" />
          {
            isReplayBasedMode(browseMode) && (
              (browseMode === BROWSE_MODE.HEAD) ?
              <div style={{ display: 'flex', width: 188 }}></div> :
              (browseMode === BROWSE_MODE.TAIL) ?
                <div style={{ display: 'flex', width: 188 }}></div> :
                (browseMode === BROWSE_MODE.MSGID) ?
                  <InputText placeholder="ID or RGMID" value={msgId} onChange={handleMsgIdTextChange} /> :
                  (browseMode === BROWSE_MODE.TIME) ?
                    <Calendar placeholder="Beginning of log" visible={calendarVisible} value={dateTime} showTime
                      onVisibleChange={handleCalendarVisibleChangle} onChange={handleCalendarChange} minDate={minDate} maxDate={maxDate}
                    /> :
                    <InputText disabled={true} placeholder="Invalid browse mode" />
            )
          }
          <Button onClick={handleRefreshClick} size="small">Refresh</Button>
        </div>}
    />
  );
}