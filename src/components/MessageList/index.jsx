import { useEffect, useState, useRef } from 'react';

import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { FilterMatchMode } from 'primereact/api';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Toast } from 'primereact/toast';
import { Checkbox } from 'primereact/checkbox';

import MessageListToolbar from './MessageListToolbar';
import { ActionApiClient } from '../../utils/solace/semp/actionApi';
import { BulkOperationManager } from '../../utils/bulkOperationManager';
import { SOURCE_TYPE } from '../../hooks/solace';
import QueueSelectionDialog from '../QueueSelectionDialog';
import BulkOperationProgressDialog from '../BulkOperationProgressDialog';
import BulkOperationResultDialog from '../BulkOperationResultDialog';

import classes from './styles.module.css';

export default function MessageList({ sourceDefinition, browser, selectedMessage, onBrowseFromChange, onMessageSelect }) {
  const { sourceName, type, config } = sourceDefinition;
  const [replayLogTimeRange, setReplayLogTimeRange] = useState({ });
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [globalFilterValue, setGlobalFilterValue] = useState('');
  const [filters, setFilters] = useState({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS }
  });
  const toast = useRef(null);
  const actionApiClient = useRef(new ActionApiClient());
  const bulkOperationManager = useRef(new BulkOperationManager());
  const cancelTokenRef = useRef(null);
  
  // Individual message operations
  const [queueDialogVisible, setQueueDialogVisible] = useState(false);
  const [pendingOperation, setPendingOperation] = useState(null); // 'copy' or 'move'
  const [pendingMessage, setPendingMessage] = useState(null);
  
  // Bulk operations
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [bulkOperationInProgress, setBulkOperationInProgress] = useState(false);
  const [bulkOperationProgress, setBulkOperationProgress] = useState(0);
  const [bulkOperationStatus, setBulkOperationStatus] = useState('');
  const [bulkOperationResults, setBulkOperationResults] = useState(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [pendingBulkOperation, setPendingBulkOperation] = useState(null); // 'copy', 'move', or 'delete'
  const [currentBulkOperationType, setCurrentBulkOperationType] = useState(null); // Stores operation type for result dialog
  const [abortOnError, setAbortOnError] = useState(false);
  const [suppressAutoLoad, setSuppressAutoLoad] = useState(false); // Flag to suppress automatic message loading

  const loadMessages = async (loader) => {
    setIsLoading(true);
    try {
      const loadedMessages = await loader();
      setMessages(loadedMessages);
      // Clear selection when messages are reloaded (messages may have changed)
      setSelectedMessages([]);
    } catch (err) {
      console.error('Error loding messages', err);
      setMessages([]); // TODO: also show error toast notification?
      setSelectedMessages([]);
    }
    setIsLoading(false);
  };

  const handleBrowseFromChange = (browseFrom) => {
    // Handle clearMessages directly in MessageList
    if (browseFrom && browseFrom.clearMessages) {
      setMessages([]);
      setSelectedMessages([]);
      setSuppressAutoLoad(true); // Suppress automatic loading for partitioned queues
      // Don't pass clearMessages to parent, just handle browseMode
      if (browseFrom.browseMode !== undefined) {
        onBrowseFromChange({ browseMode: browseFrom.browseMode });
      }
      return;
    }
    // Normal browse from change - re-enable auto loading
    setSuppressAutoLoad(false);
    onBrowseFromChange(browseFrom);
  };

  useEffect(() => {
    browser.getReplayTimeRange().then(range => setReplayLogTimeRange(range));
    setMessages([]);
    setSelectedMessages([]); // Clear selection when browser changes
    // Only load messages if not suppressed (for partitioned queues)
    if (!suppressAutoLoad) {
      loadMessages(() => browser.getFirstPage());
    }
  }, [browser, suppressAutoLoad]);

  const handleBulkSelection = (e) => {
    // Handle multi-select for bulk operations
    // Only allow selection via checkbox, not row clicks
    let allowSelection = false;
    
    if (!e.originalEvent) {
      // No originalEvent means it's programmatic (e.g., "Select All" checkbox) - allow it
      allowSelection = true;
    } else {
      const eventType = e.originalEvent.type;
      const target = e.originalEvent.target;
      
      // Checkbox changes fire 'change' events
      if (eventType === 'change') {
        allowSelection = true;
      } else if (target) {
        // Check if the target is a checkbox or within checkbox elements
        if (target.type === 'checkbox' || target.tagName === 'INPUT' && target.getAttribute('type') === 'checkbox') {
          allowSelection = true;
        } else if (target.closest && typeof target.closest === 'function') {
          const checkboxParent = target.closest('.p-checkbox') || 
                                target.closest('.p-checkbox-box') || 
                                target.closest('.p-checkbox-icon') ||
                                target.closest('input[type="checkbox"]');
          allowSelection = checkboxParent !== null;
        }
      }
    }
    
    if (allowSelection) {
      const selected = Array.isArray(e.value) ? e.value : [];
      setSelectedMessages(selected);
    }
    // If it's a row click (click event on non-checkbox), ignore the selection change
  };

  const handleRowClick = (e) => {
    // Handle single selection for message detail view (on row click, not checkbox)
    // Prevent row click from selecting for bulk operations
    const isCheckbox = e.originalEvent?.target?.closest?.('.p-checkbox') ||
                      e.originalEvent?.target?.type === 'checkbox';
    
    if (e.data && !isCheckbox) {
      onMessageSelect?.(e.data);
    }
  };

  const handleFilterChange = (e) => {
    const value = e.target.value;
    setFilters({ global: { ...filters.global, value } });
    setGlobalFilterValue(value);
  };

  const handleFirstClick = () => {
    loadMessages(() => browser.getFirstPage());
  };

  const handleNextClick = () => {
    loadMessages(() => browser.getNextPage());
  };

  const handlePrevClick = () => {
    loadMessages(() => browser.getPrevPage());
  };

  const handleDeleteMessage = (message) => {
    const msgId = message.meta?.msgId;
    const msgIdDisplay = msgId || message.meta?.replicationGroupMsgId || 'Unknown';
    
    confirmDialog({
      message: `Are you sure you want to delete message ${msgIdDisplay}? This action cannot be undone.`,
      header: 'Delete Message',
      icon: 'pi pi-exclamation-triangle',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        await performDelete(message);
      }
    });
  };

  const performDelete = async (message) => {
    if (!config || !sourceName) {
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Broker configuration or queue name is missing.',
        life: 5000
      });
      return;
    }

    const msgId = message.meta?.msgId;
    if (!msgId) {
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Message ID is missing. Cannot delete message.',
        life: 5000
      });
      return;
    }

    setIsLoading(true);
    try {
      const vpn = config.vpn;
      
      // Determine if it's a queue or topic endpoint
      if (type === SOURCE_TYPE.QUEUE || type === SOURCE_TYPE.BASIC) {
        await actionApiClient.current.deleteQueueMessage(config, vpn, sourceName, msgId);
      } else if (type === SOURCE_TYPE.TOPIC) {
        await actionApiClient.current.deleteTopicEndpointMessage(config, vpn, sourceName, msgId);
      } else {
        throw new Error(`Unsupported source type: ${type}`);
      }

      toast.current.show({
        severity: 'success',
        summary: 'Success',
        detail: `Message ${msgId} deleted successfully.`,
        life: 3000
      });

      // Refresh the current page to reflect the deletion
      // Reload the first page to ensure we see the updated message list
      await loadMessages(() => browser.getFirstPage());

      // Clear selection if deleted message was selected
      if (selectedMessage?.meta?.msgId === msgId) {
        onMessageSelect?.(null);
      }
    } catch (err) {
      console.error('Error deleting message:', err);
      const errorDetail = err.response?.body?.meta?.error?.description || 
                         err.message || 
                         'Unknown error occurred while deleting message.';
      
      toast.current.show({
        severity: 'error',
        summary: 'Delete Failed',
        detail: errorDetail,
        life: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyMessage = (message) => {
    if (!config || !sourceName) {
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Broker configuration or queue name is missing.',
        life: 5000
      });
      return;
    }

    const replicationGroupMsgId = message.headers?.replicationGroupMsgId || message.meta?.replicationGroupMsgId;
    if (!replicationGroupMsgId) {
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Replication Group Message ID is missing. Cannot copy message.',
        life: 5000
      });
      return;
    }

    // Only allow copy for queues (not topic endpoints)
    if (type !== SOURCE_TYPE.QUEUE && type !== SOURCE_TYPE.BASIC) {
      toast.current.show({
        severity: 'warn',
        summary: 'Not Supported',
        detail: 'Copy operation is only supported for queues.',
        life: 5000
      });
      return;
    }

    setPendingMessage(message);
    setPendingOperation('copy');
    setQueueDialogVisible(true);
  };

  const handleMoveMessage = (message) => {
    if (!config || !sourceName) {
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Broker configuration or queue name is missing.',
        life: 5000
      });
      return;
    }

    const replicationGroupMsgId = message.headers?.replicationGroupMsgId || message.meta?.replicationGroupMsgId;
    if (!replicationGroupMsgId) {
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Replication Group Message ID is missing. Cannot move message.',
        life: 5000
      });
      return;
    }

    // Only allow move for queues (not topic endpoints)
    if (type !== SOURCE_TYPE.QUEUE && type !== SOURCE_TYPE.BASIC) {
      toast.current.show({
        severity: 'warn',
        summary: 'Not Supported',
        detail: 'Move operation is only supported for queues.',
        life: 5000
      });
      return;
    }

    const msgIdDisplay = message.meta?.msgId || replicationGroupMsgId || 'Unknown';
    
    confirmDialog({
      message: `Are you sure you want to move message ${msgIdDisplay}? This will copy it to the destination queue and delete it from the current queue.`,
      header: 'Move Message',
      icon: 'pi pi-exclamation-triangle',
      acceptClassName: 'p-button-warning',
      accept: () => {
        setPendingMessage(message);
        setPendingOperation('move');
        setQueueDialogVisible(true);
      }
    });
  };

  const handleQueueSelected = async (destQueueName) => {
    if (!pendingMessage || !pendingOperation) {
      return;
    }

    setQueueDialogVisible(false);
    const message = pendingMessage;
    const operation = pendingOperation;
    setPendingMessage(null);
    setPendingOperation(null);

    const replicationGroupMsgId = message.headers?.replicationGroupMsgId || message.meta?.replicationGroupMsgId;
    const msgId = message.meta?.msgId;
    const msgIdDisplay = msgId || replicationGroupMsgId || 'Unknown';

    if (!config || !sourceName || !replicationGroupMsgId) {
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Required information is missing.',
        life: 5000
      });
      return;
    }

    setIsLoading(true);
    try {
      const vpn = config.vpn;

      // Perform copy operation
      await actionApiClient.current.copyQueueMessage(
        config,
        vpn,
        destQueueName,
        replicationGroupMsgId,
        sourceName
      );

      // If move operation, delete the message from source
      if (operation === 'move') {
        if (!msgId) {
          toast.current.show({
            severity: 'error',
            summary: 'Move Failed',
            detail: 'Message ID is missing. Message was copied but not deleted from source.',
            life: 5000
          });
          setIsLoading(false);
          await loadMessages(() => browser.getFirstPage());
          return;
        }

        try {
          await actionApiClient.current.deleteQueueMessage(config, vpn, sourceName, msgId);
        } catch (deleteErr) {
          console.error('Error deleting message after copy:', deleteErr);
          const deleteErrorDetail = deleteErr.response?.body?.meta?.error?.description || 
                                  deleteErr.message || 
                                  'Unknown error occurred while deleting message.';
          
          toast.current.show({
            severity: 'warn',
            summary: 'Partial Success',
            detail: `Message was copied to ${destQueueName}, but failed to delete from source: ${deleteErrorDetail}`,
            life: 7000
          });
          setIsLoading(false);
          await loadMessages(() => browser.getFirstPage());
          return;
        }
      }

      // Success feedback
      const operationText = operation === 'move' ? 'moved' : 'copied';
      toast.current.show({
        severity: 'success',
        summary: 'Success',
        detail: `Message ${msgIdDisplay} ${operationText} to ${destQueueName} successfully.`,
        life: 3000
      });

      // Refresh the message list
      await loadMessages(() => browser.getFirstPage());

      // Clear selection if the moved/copied message was selected
      if (selectedMessage?.meta?.replicationGroupMsgId === replicationGroupMsgId) {
        if (operation === 'move') {
          onMessageSelect?.(null);
        }
      }
    } catch (err) {
      console.error(`Error ${operation}ing message:`, err);
      const errorDetail = err.response?.body?.meta?.error?.description || 
                         err.message || 
                         `Unknown error occurred while ${operation}ing message.`;
      
      const operationText = operation === 'move' ? 'Move' : 'Copy';
      toast.current.show({
        severity: 'error',
        summary: `${operationText} Failed`,
        detail: errorDetail,
        life: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const actionButtonsBody = (rowData) => {
    // Only show action buttons if we have a valid config
    if (!config) {
      return null;
    }

    // Only show copy/move for queues
    const showCopyMove = type === SOURCE_TYPE.QUEUE || type === SOURCE_TYPE.BASIC;
    
    return (
      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
        {showCopyMove && (
          <>
            <Button
              icon="pi pi-copy"
              severity="secondary"
              text
              rounded
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleCopyMessage(rowData);
              }}
              aria-label="Copy message"
              tooltip="Copy message"
              tooltipOptions={{ position: 'top' }}
            />
            <Button
              icon="pi pi-arrow-right"
              severity="warning"
              text
              rounded
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleMoveMessage(rowData);
              }}
              aria-label="Move message"
              tooltip="Move message"
              tooltipOptions={{ position: 'top' }}
            />
          </>
        )}
        <Button
          icon="pi pi-trash"
          severity="danger"
          text
          rounded
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteMessage(rowData);
          }}
          aria-label="Delete message"
          tooltip="Delete message"
          tooltipOptions={{ position: 'top' }}
        />
      </div>
    );
  };

  const deleteActionBody = (rowData) => {
    // Only show delete button if we have a valid config
    if (!config) {
      return null;
    }
    
    return (
      <Button
        icon="pi pi-trash"
        severity="danger"
        text
        rounded
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          handleDeleteMessage(rowData);
        }}
        aria-label="Delete message"
        tooltip="Delete message"
        tooltipOptions={{ position: 'top' }}
      />
    );
  };

  const messageStatus = (message) => {
    return message.payload !== undefined ? null : (
      <i className="pi pi-question-circle text-yellow-500"></i>
    );
  }

  const formatDateTime = (message) => {
    const spooledTime = message.meta?.spooledTime;
    if (!spooledTime) {
      return 'Not Available';
    }
    const spooledEpoc = spooledTime * 1000;
    const tzOffset = new Date(spooledEpoc).getTimezoneOffset() * 60000;
    return new Date(spooledEpoc - tzOffset).toISOString().replace('T', ' ').slice(0, 19);
  }

  const addFilterField = (message) => ({
    ...message, filterField: [
      message.payload,
      ...Object.values(message.meta || {}),
      ...Object.values(message.headers || {}),
      ...Object.values(message.userProperties || {})
    ]
  });

  const getRowClassName = (rowData) => {
    if (!selectedMessage) {
      return '';
    }
    
    // Compare by replicationGroupMsgId first (more reliable), then fall back to msgId
    const selectedId = selectedMessage.meta?.replicationGroupMsgId || selectedMessage.meta?.msgId;
    const rowId = rowData.meta?.replicationGroupMsgId || rowData.meta?.msgId;
    
    if (selectedId && rowId && selectedId === rowId) {
      return classes.selectedRow;
    }
    
    return '';
  };

  const ListHeader = () => {
    const hasSelection = selectedMessages.length > 0;
    const showCopyMove = type === SOURCE_TYPE.QUEUE || type === SOURCE_TYPE.BASIC;
    const buttonsDisabled = !hasSelection || bulkOperationInProgress;
    
    return (
      <div className="flex justify-content-between align-items-center">
        <div className="flex align-items-center gap-2">
          {showCopyMove && (
            <>
              <Button
                icon="pi pi-copy"
                severity="secondary"
                size="small"
                onClick={handleBulkCopy}
                disabled={buttonsDisabled}
                tooltip="Copy selected messages"
                tooltipOptions={{ position: 'bottom' }}
              />
              <Button
                icon="pi pi-arrow-right"
                severity="warning"
                size="small"
                onClick={handleBulkMove}
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
            onClick={handleBulkDelete}
            disabled={buttonsDisabled}
            tooltip="Delete selected messages"
            tooltipOptions={{ position: 'bottom' }}
          />
          <span className="text-sm font-medium">{selectedMessages.length} selected</span>
        </div>
        <IconField iconPosition="left">
          <InputIcon className="pi pi-search" />
          <InputText value={globalFilterValue} onChange={handleFilterChange} placeholder="Message Search" />
        </IconField>
      </div>
    );
  };

  const ListFooter = () => {
    return (
      <div>
        <Button text onClick={handleFirstClick}>First</Button>
        <Button text onClick={handlePrevClick} disabled={!browser.hasPrevPage()}>&lt; Prev</Button>
        <Button text onClick={handleNextClick} disabled={!browser.hasNextPage()}>Next &gt;</Button>
      </div>
    );
  };

  // Bulk operation handlers
  const handleBulkDelete = () => {
    if (selectedMessages.length === 0) {
      toast.current.show({
        severity: 'warn',
        summary: 'No Selection',
        detail: 'Please select messages to delete.',
        life: 3000
      });
      return;
    }

    confirmDialog({
      message: (
        <div>
          <p>Are you sure you want to delete {selectedMessages.length} message(s)? This action cannot be undone.</p>
          <div className="flex align-items-center gap-2 mt-3">
            <Checkbox 
              inputId="abortOnError" 
              checked={abortOnError} 
              onChange={(e) => setAbortOnError(e.checked)} 
            />
            <label htmlFor="abortOnError" className="text-sm">Stop on first error</label>
          </div>
        </div>
      ),
      header: 'Delete Messages',
      icon: 'pi pi-exclamation-triangle',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        await performBulkDelete(selectedMessages);
      }
    });
  };

  const handleBulkCopy = () => {
    if (selectedMessages.length === 0) {
      toast.current.show({
        severity: 'warn',
        summary: 'No Selection',
        detail: 'Please select messages to copy.',
        life: 3000
      });
      return;
    }

    if (type !== SOURCE_TYPE.QUEUE && type !== SOURCE_TYPE.BASIC) {
      toast.current.show({
        severity: 'warn',
        summary: 'Not Supported',
        detail: 'Copy operation is only supported for queues.',
        life: 5000
      });
      return;
    }

    setPendingBulkOperation('copy');
    setQueueDialogVisible(true);
  };

  const handleBulkMove = () => {
    if (selectedMessages.length === 0) {
      toast.current.show({
        severity: 'warn',
        summary: 'No Selection',
        detail: 'Please select messages to move.',
        life: 3000
      });
      return;
    }

    if (type !== SOURCE_TYPE.QUEUE && type !== SOURCE_TYPE.BASIC) {
      toast.current.show({
        severity: 'warn',
        summary: 'Not Supported',
        detail: 'Move operation is only supported for queues.',
        life: 5000
      });
      return;
    }

    confirmDialog({
      message: (
        <div>
          <p>Are you sure you want to move {selectedMessages.length} message(s)? This will copy them to the destination queue and delete them from the current queue.</p>
          <div className="flex align-items-center gap-2 mt-3">
            <Checkbox 
              inputId="abortOnErrorMove" 
              checked={abortOnError} 
              onChange={(e) => setAbortOnError(e.checked)} 
            />
            <label htmlFor="abortOnErrorMove" className="text-sm">Stop on first error</label>
          </div>
        </div>
      ),
      header: 'Move Messages',
      icon: 'pi pi-exclamation-triangle',
      acceptClassName: 'p-button-warning',
      accept: () => {
        setPendingBulkOperation('move');
        setQueueDialogVisible(true);
      }
    });
  };

  const performBulkDelete = async (messages) => {
    if (!config || !sourceName) {
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Broker configuration or queue name is missing.',
        life: 5000
      });
      return;
    }

    // Create cancel token
    cancelTokenRef.current = new AbortController();

    setBulkOperationInProgress(true);
    setBulkOperationProgress(0);
    setBulkOperationStatus('Starting...');

    try {
      const results = await bulkOperationManager.current.executeBulkDelete(
        messages,
        config,
        sourceName,
        type,
        {
          onProgress: (current, total, message) => {
            const progress = (current / total) * 100;
            setBulkOperationProgress(progress);
            setBulkOperationStatus(`Deleting message ${current} of ${total}`);
          },
          abortOnError,
          cancelToken: cancelTokenRef.current.signal
        }
      );

      setBulkOperationResults(results);
      setCurrentBulkOperationType('delete');
      setBulkOperationInProgress(false);
      setShowResultDialog(true);
      
      // Refresh message list
      await loadMessages(() => browser.getFirstPage());
      
      // Clear selection
      setSelectedMessages([]);
    } catch (err) {
      console.error('Error in bulk delete:', err);
      toast.current.show({
        severity: 'error',
        summary: 'Operation Failed',
        detail: err.message || 'An error occurred during bulk delete operation.',
        life: 5000
      });
      setBulkOperationInProgress(false);
    } finally {
      cancelTokenRef.current = null;
    }
  };

  const performBulkCopy = async (messages, destQueueName) => {
    if (!config || !sourceName) {
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Broker configuration or queue name is missing.',
        life: 5000
      });
      return;
    }

    cancelTokenRef.current = new AbortController();

    setBulkOperationInProgress(true);
    setBulkOperationProgress(0);
    setBulkOperationStatus('Starting...');

    try {
      const results = await bulkOperationManager.current.executeBulkCopy(
        messages,
        destQueueName,
        config,
        sourceName,
        {
          onProgress: (current, total, message) => {
            const progress = (current / total) * 100;
            setBulkOperationProgress(progress);
            setBulkOperationStatus(`Copying message ${current} of ${total}`);
          },
          abortOnError,
          cancelToken: cancelTokenRef.current.signal
        }
      );

      setBulkOperationResults(results);
      setCurrentBulkOperationType('copy');
      setBulkOperationInProgress(false);
      setShowResultDialog(true);
      setPendingBulkOperation(null);
      
      // Refresh message list
      await loadMessages(() => browser.getFirstPage());
      
      // Preserve selection (messages remain in source)
    } catch (err) {
      console.error('Error in bulk copy:', err);
      toast.current.show({
        severity: 'error',
        summary: 'Operation Failed',
        detail: err.message || 'An error occurred during bulk copy operation.',
        life: 5000
      });
      setBulkOperationInProgress(false);
      setPendingBulkOperation(null);
    } finally {
      cancelTokenRef.current = null;
    }
  };

  const performBulkMove = async (messages, destQueueName) => {
    if (!config || !sourceName) {
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Broker configuration or queue name is missing.',
        life: 5000
      });
      return;
    }

    cancelTokenRef.current = new AbortController();

    setBulkOperationInProgress(true);
    setBulkOperationProgress(0);
    setBulkOperationStatus('Starting...');

    try {
      const results = await bulkOperationManager.current.executeBulkMove(
        messages,
        destQueueName,
        config,
        sourceName,
        {
          onProgress: (current, total, message) => {
            const progress = (current / total) * 100;
            setBulkOperationProgress(progress);
            setBulkOperationStatus(`Moving message ${current} of ${total}`);
          },
          abortOnError,
          cancelToken: cancelTokenRef.current.signal
        }
      );

      setBulkOperationResults(results);
      setCurrentBulkOperationType('move');
      setBulkOperationInProgress(false);
      setShowResultDialog(true);
      setPendingBulkOperation(null);
      
      // Refresh message list
      await loadMessages(() => browser.getFirstPage());
      
      // Clear selection (messages moved from source)
      setSelectedMessages([]);
    } catch (err) {
      console.error('Error in bulk move:', err);
      toast.current.show({
        severity: 'error',
        summary: 'Operation Failed',
        detail: err.message || 'An error occurred during bulk move operation.',
        life: 5000
      });
      setBulkOperationInProgress(false);
      setPendingBulkOperation(null);
    } finally {
      cancelTokenRef.current = null;
    }
  };

  const handleBulkQueueSelected = async (destQueueName) => {
    setQueueDialogVisible(false);
    
    if (!pendingBulkOperation || selectedMessages.length === 0) {
      setPendingBulkOperation(null);
      return;
    }

    const operation = pendingBulkOperation;
    const messages = [...selectedMessages];

    if (operation === 'copy') {
      await performBulkCopy(messages, destQueueName);
    } else if (operation === 'move') {
      await performBulkMove(messages, destQueueName);
    }
  };

  const handleCancelBulkOperation = () => {
    if (cancelTokenRef.current) {
      cancelTokenRef.current.abort();
      cancelTokenRef.current = null;
    }
    setBulkOperationInProgress(false);
    setBulkOperationProgress(0);
    setBulkOperationStatus('');
  };

  return (
    (sourceName) ? (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
        <MessageListToolbar sourceDefinition={sourceDefinition} minTime={replayLogTimeRange.min} maxTime={replayLogTimeRange.max} onChange={handleBrowseFromChange} />
        <div style={{ flex: '1', overflow: 'hidden' }}>
          <DataTable
            className={classes.messageListTable}
            value={messages.map(addFilterField)}
            size="small"
            scrollable
            resizableColumns
            selectionMode="multiple"
            selection={selectedMessages}
            dataKey="meta.replicationGroupMsgId"
            onSelectionChange={handleBulkSelection}
            onRowClick={handleRowClick}
            rowClassName={getRowClassName}
            metaKeySelection={false}
            globalFilterFields={['filterField']}
            filters={filters}
            header={ListHeader}
            footer={ListFooter}
            loading={isLoading}
            emptyMessage="No messages to browse or Browsing not supported."
          >
            <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} />
            <Column body={messageStatus} />
            <Column field="meta.msgId" header="MsgID" />
            <Column field="headers.applicationMessageId" header="ApplicationMsgID" body ={(rowData) => rowData.headers?.applicationMessageId ?? 'Not Available' }/>
            <Column field="headers.applicationMessageType" header="ApplicationMsgType" body ={(rowData) => rowData.headers?.applicationMessageType ?? 'Not Available' } />
            <Column body={formatDateTime} header="SpoolTime" />
            <Column field="meta.attachmentSize" header="MsgSize(B)" />
            <Column body={actionButtonsBody} header="Actions" style={{ width: (type === SOURCE_TYPE.QUEUE || type === SOURCE_TYPE.BASIC) ? '180px' : '80px' }} />
          </DataTable>
        </div>
        <ConfirmDialog />
        <Toast ref={toast} />
        <QueueSelectionDialog
          visible={queueDialogVisible}
          config={config}
          currentQueueName={sourceName}
          onSelect={pendingBulkOperation ? handleBulkQueueSelected : handleQueueSelected}
          onHide={() => {
            setQueueDialogVisible(false);
            if (pendingBulkOperation) {
              setPendingBulkOperation(null);
            } else {
              setPendingMessage(null);
              setPendingOperation(null);
            }
          }}
        />
        <BulkOperationProgressDialog
          visible={bulkOperationInProgress}
          progress={bulkOperationProgress}
          status={bulkOperationStatus}
          total={selectedMessages.length}
          current={Math.round((bulkOperationProgress / 100) * selectedMessages.length)}
          onCancel={handleCancelBulkOperation}
        />
        <BulkOperationResultDialog
          visible={showResultDialog}
          results={bulkOperationResults}
          operationType={currentBulkOperationType || 'delete'}
          onClose={() => {
            setShowResultDialog(false);
            setBulkOperationResults(null);
            setCurrentBulkOperationType(null);
          }}
        />
      </div>
    ) : (
      <div style={{ margin: '1em' }}>Please select a queue or topic to browse.</div>
    )
  );
}