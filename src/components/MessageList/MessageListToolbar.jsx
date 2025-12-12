import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';

import { Button } from 'primereact/button';
import { Calendar } from 'primereact/calendar';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { Toolbar } from 'primereact/toolbar';
import { Toast } from 'primereact/toast';
import { confirmDialog } from 'primereact/confirmdialog';

import { SOURCE_TYPE, BROWSE_MODE, SUPPORTED_BROWSE_MODES, MESSAGE_ORDER } from '../../hooks/solace';
import { useSempApi } from '../../providers/SempClientProvider';

import classes from './styles.module.css';

const MessageListToolbar = forwardRef(function MessageListToolbar({ 
  sourceDefinition, 
  minTime, 
  maxTime, 
  onChange,
  // Props for Row 2 controls
  selectedMessages = [],
  globalFilterValue = '',
  onFilterChange,
  onBulkCopy,
  onBulkMove,
  onBulkDelete,
  bulkOperationInProgress = false
}, ref) {
  const { type: sourceType, sourceName, config } = sourceDefinition;
  const { id: brokerId } = config || {};

  const sempApi = useSempApi();
  const [messageCount, setMessageCount] = useState(null);
  const [queueDetails, setQueueDetails] = useState(null);
  const partitionedToastShownFor = useRef(null); // Track which queue we've shown the toast for
  const queueDetailsLoadedFor = useRef(null); // Track which queue we've loaded details for
  const toast = useRef(null);

  // Fetch queue message count and details
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

  // Expose refresh function to parent component
  useImperativeHandle(ref, () => ({
    refreshQueueDetails: fetchQueueDetails
  }));

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

  // Check if the queue is partitioned (partitions > 0)
  // Only check if queueDetails exist and we're currently viewing a queue (not a topic)
  const isPartitionedQueue = () => {
    if (!queueDetails || (sourceType !== SOURCE_TYPE.QUEUE && sourceType !== SOURCE_TYPE.BASIC)) {
      return false;
    }
    // Only consider it partitioned if queueDetails match the current source
    // This prevents using stale queueDetails from a previous queue
    if (queueDetails.queueName !== sourceName) {
      return false;
    }
    const partitions = queueDetails.partitionCount ?? 0;
    return partitions > 0;
  };

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
    // Reset the toast tracking when source changes
    partitionedToastShownFor.current = null;
    queueDetailsLoadedFor.current = null;
    // Clear queue details immediately to prevent stale data from being used
    setQueueDetails(null);
    setMessageCount(null);
    // Don't call raiseOnChange here - wait for queueDetails to load
    // The queueDetails effect will trigger browsing for non-partitioned queues
  }, [brokerId, sourceType, sourceName]);

  // Fetch queue message count and details when a queue is selected
  useEffect(() => {
    fetchQueueDetails();
  }, [sourceType, sourceName, config]);

  // Show warning dialog when a partitioned queue is detected (only once per queue selection)
  // Also trigger browsing when a non-partitioned queue is loaded
  useEffect(() => {
    if (queueDetails && (sourceType === SOURCE_TYPE.QUEUE || sourceType === SOURCE_TYPE.BASIC)) {
      // Ensure queue details match the current source to prevent stale data issues
      if (queueDetails.queueName !== sourceName) {
        return;
      }

      const partitions = queueDetails.partitionCount ?? 0;
      
      if (partitions > 0) {
        // Partitioned queue - clear message list immediately
        if (queueDetailsLoadedFor.current !== sourceName) {
          queueDetailsLoadedFor.current = sourceName;
          // Clear messages for partitioned queue
          onChange({ browseMode: null, clearMessages: true });
        }
        
        // Show toast if we haven't shown it for this queue yet
        if (partitionedToastShownFor.current !== sourceName) {
          partitionedToastShownFor.current = sourceName;
          toast.current?.show({
            severity: 'warn',
            summary: 'Browsing Unsupported for this Queue',
            detail: 'Browsing is not supported for Partitioned Queues.',
            life: 5000
          });
        }
        // Don't trigger browsing for partitioned queues
      } else {
        // Non-partitioned queue - trigger browsing if we haven't already loaded for this queue
        if (queueDetailsLoadedFor.current !== sourceName) {
          queueDetailsLoadedFor.current = sourceName;
          // Trigger browse for the current mode
          raiseOnChange(browseMode);
        }
      }
    }
  }, [queueDetails, sourceType, sourceName]);

  // NOTE: Removed useEffect for browseMode changes to prevent infinite loops
  // Browse mode changes are now handled through user interactions and initial queue loading

  const raiseOnChange = (browseMode) => {
    // Don't proceed if queueDetails don't exist yet (still loading)
    // This prevents using stale data or showing popups for wrong queues
    if (!queueDetails && (sourceType === SOURCE_TYPE.QUEUE || sourceType === SOURCE_TYPE.BASIC)) {
      // Queue details are still loading, wait for them
      return;
    }

    // If partitioned queue, just silently prevent browsing
    // (Dialog is handled in useEffect when queue details are loaded)
    if (isPartitionedQueue()) {
      return;
    }

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
    // Check if this is a partitioned queue - browsing is not supported
    if (isPartitionedQueue()) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Browsing Unsupported for this Queue',
        detail: 'Browsing is not supported for Partitioned Queues.',
        life: 5000
      });
      return;
    }

    // If selecting a replay-based mode, show confirmation dialog
    if (isReplayBasedMode(mode)) {
      confirmDialog({
        message: 'This sort order needs Replay and temporary queues to work. Do you want to proceed?',
        header: '(BETA) Custom Sort Order',
        icon: 'pi pi-info-circle',
        accept: () => {
          setBrowseMode(mode);
          // Trigger browsing with new mode
          setTimeout(() => raiseOnChange(mode), 0);
        },
        reject: () => {
          // Fall back to Default (BASIC mode)
          setBrowseMode(BROWSE_MODE.BASIC);
          // Trigger browsing with basic mode
          setTimeout(() => raiseOnChange(BROWSE_MODE.BASIC), 0);
        }
      });
    } else {
      // Default - no confirmation needed
      setBrowseMode(mode);
      // Trigger browsing with new mode
      setTimeout(() => raiseOnChange(mode), 0);
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

    return `${formatNumber(count)} messages | Utilization: ${utilization}% | Size: ${formatMegabytes(spoolSize)}  | Owner: ${owner} | Permission: ${permission} | Type: ${accessType} | Partitions: ${partitions}`;
  };

  const partitioned = isPartitionedQueue();
  const hasSelection = selectedMessages.length > 0;
  const showCopyMove = sourceType === SOURCE_TYPE.QUEUE || sourceType === SOURCE_TYPE.BASIC;
  const buttonsDisabled = !hasSelection || bulkOperationInProgress;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Toast ref={toast} position="top-right" />
      {/* Row 1: Queue Name and Details (left) */}
      <Toolbar 
        className={`${classes.messageListToolbar} ${classes.messageListToolbarFirstRow}`}
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
      />
      
      {/* Row 2: Search | Sort Order | Sort Order Additional Input (left) | N selected | Actions | Refresh (right) */}
      <Toolbar className={`${classes.messageListToolbar} ${classes.messageListToolbarSecondRow}`}
        start={() => {
          const hasSearchText = globalFilterValue && String(globalFilterValue).trim().length > 0;
          return (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {/* Search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
                <IconField iconPosition="left">
                  <InputIcon className="pi pi-search" />
                  <InputText 
                    value={globalFilterValue || ''} 
                    onChange={onFilterChange} 
                    placeholder="Message Search" 
                  />
                </IconField>
                <Button
                  icon="pi pi-times"
                  severity="secondary"
                  rounded
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFilterChange({ target: { value: '' } });
                  }}
                  disabled={!hasSearchText}
                  tooltip="Clear search"
                  tooltipOptions={{ position: 'bottom' }}
                  style={{ 
                    minWidth: '2rem',
                    width: '2rem',
                    height: '2rem',
                    padding: 0,
                    flexShrink: 0
                  }}
                />
              </div>
              
              {/* Sort Order */}
              <label>Sort By</label>
              <Dropdown 
                value={browseMode} 
                onChange={handleBrowseModeChange} 
                options={browseModes} 
                optionLabel="name" 
                disabled={partitioned}
              />
              
              {/* Sort Order Additional Input (Date range / Message ID) */}
              {isReplayBasedMode(browseMode) && (
                (browseMode === BROWSE_MODE.HEAD) ?
                null :
                (browseMode === BROWSE_MODE.TAIL) ?
                  null :
                  (browseMode === BROWSE_MODE.MSGID) ?
                    <InputText 
                      placeholder="ID or RGMID" 
                      value={msgId} 
                      onChange={handleMsgIdTextChange} 
                      disabled={partitioned}
                    /> :
                    (browseMode === BROWSE_MODE.TIME) ?
                      <Calendar 
                        placeholder="Beginning of log" 
                        visible={calendarVisible} 
                        value={dateTime} 
                        showTime
                        onVisibleChange={handleCalendarVisibleChangle} 
                        onChange={handleCalendarChange} 
                        minDate={minDate} 
                        maxDate={maxDate}
                        disabled={partitioned}
                      /> :
                      null
              )}
            </div>
          );
        }}
        end={() => (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* N selected */}
            <span className="text-sm font-medium">{selectedMessages.length} selected</span>
            
            {/* Actions */}
            {showCopyMove && (
              <>
                <Button
                  icon="pi pi-copy"
                  severity="secondary"
                  size="small"
                  onClick={onBulkCopy}
                  disabled={buttonsDisabled}
                  tooltip="Copy selected messages"
                  tooltipOptions={{ position: 'bottom' }}
                />
                <Button
                  icon="pi pi-arrow-right"
                  severity="warning"
                  size="small"
                  onClick={onBulkMove}
                  disabled={buttonsDisabled}
                  tooltip="Move selected messages"
                  tooltipOptions={{ position: 'bottom' }}
                />
              </>
            )}
            <Button
              icon="pi pi-trash"
              severity="danger"
              size="small"
              onClick={onBulkDelete}
              disabled={buttonsDisabled}
              tooltip="Delete selected messages"
              tooltipOptions={{ position: 'bottom' }}
            />
            
            {/* Refresh */}
            <Button 
              icon="pi pi-refresh" 
              onClick={handleRefreshClick} 
              size="small" 
              disabled={partitioned}
              tooltip="Refresh"
              tooltipOptions={{ position: 'bottom' }}
            />
          </div>
        )}
      />
    </div>
  );
});

export default MessageListToolbar;