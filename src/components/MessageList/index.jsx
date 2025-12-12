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
import { Dropdown } from 'primereact/dropdown';

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
  const toolbarRef = useRef(null);
  
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
  const [pageSize, setPageSize] = useState(100);

  const loadMessages = async (loader) => {
    setIsLoading(true);
    try {
      const loadedMessages = await loader();
      setMessages(loadedMessages);
      // Clear selection when messages are reloaded (messages may have changed)
      setSelectedMessages([]);
    } catch (err) {
      setMessages([]);
      setSelectedMessages([]);
      
      const errorMessage = err.message || 'Unknown error occurred while loading messages.';
      const isPermissionError = 
        errorMessage.includes('does not have permissions') ||
        errorMessage.includes('Permission Not Allowed') ||
        errorMessage.includes('Access denied') ||
        errorMessage.includes('Permission');
      
      // Suppress "Invalid state: expected 'opening', current value 'closing'" errors
      // These are race conditions during browser state transitions and don't need user notification
      const isStateTransitionError = 
        errorMessage.includes('Invalid state') &&
        errorMessage.includes("expected 'opening'") &&
        errorMessage.includes("current value 'closing'");
      
      // Show toast for permission errors
      if (isPermissionError) {
        // Permission errors are expected and user is notified via toast, so log at debug level
        console.debug('Permission error (user notified via toast):', errorMessage);
        // Use setTimeout to ensure the toast is shown after the current render cycle
        setTimeout(() => {
          toast.current?.show({
            severity: 'warn',
            summary: 'Permission Denied',
            detail: errorMessage,
            life: 5000
          });
        }, 0);
      } else if (isStateTransitionError) {
        // State transition errors are race conditions, suppress notification
        console.debug('State transition error (suppressed):', errorMessage);
      } else {
        // Log unexpected errors at error level
        console.error('Error loading messages', err);
        // Show error toast notification for other errors
        toast.current?.show({
          severity: 'error',
          summary: 'Error Loading Messages',
          detail: errorMessage,
          life: 7000
        });
      }
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
    browser.getReplayTimeRange().then(range => setReplayLogTimeRange(range)).catch(err => {
      console.warn('Error getting replay time range:', err);
      setReplayLogTimeRange({ min: null, max: null });
    });
    setMessages([]);
    setSelectedMessages([]); // Clear selection when browser changes
    // Initialize page size from browser
    if (browser.pageSize) {
      setPageSize(browser.pageSize);
    }
    // Only load messages if not suppressed (for partitioned queues)
    if (!suppressAutoLoad) {
      loadMessages(() => browser.getFirstPage());
    }
  }, [browser, suppressAutoLoad]);

  // Clear search string when queue is selected
  useEffect(() => {
    setGlobalFilterValue('');
    setFilters({ global: { value: null, matchMode: FilterMatchMode.CONTAINS } });
  }, [sourceName, type, config?.id]);

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

  const pageSizeOptions = [
    { label: '25', value: 25 },
    { label: '50', value: 50 },
    { label: '100', value: 100 },
    { label: '200', value: 200 },
    { label: '500', value: 500 }
  ];

  const handlePageSizeChange = (e) => {
    const newPageSize = e.value;
    setPageSize(newPageSize);
    browser.pageSize = newPageSize;
    // Reload current page with new page size
    loadMessages(() => browser.getFirstPage());
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

      // Refresh queue summary to reflect new message count
      toolbarRef.current?.refreshQueueDetails?.();

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
      message: `Are you sure you want to move message ${msgIdDisplay}? The message will be deleted from the current queue.`,
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
          // Refresh queue summary even on partial success (message count may have changed)
          toolbarRef.current?.refreshQueueDetails?.();
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

      // Refresh queue summary to reflect new message count (only for move operations)
      if (operation === 'move') {
        toolbarRef.current?.refreshQueueDetails?.();
      }

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

  // ListHeader is now integrated into MessageListToolbar Row 2
  const ListHeader = () => null;

  const ListFooter = () => {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Button text onClick={handleFirstClick}>&lt;&lt; First</Button>
        <Button text onClick={handlePrevClick} disabled={!browser.hasPrevPage()}>&lt; Prev</Button>
        <Dropdown
          value={pageSize}
          onChange={handlePageSizeChange}
          options={pageSizeOptions}
          optionLabel="label"
          optionValue="value"
          style={{ minWidth: '5rem' }}
        />
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
      message: `Are you sure you want to move ${selectedMessages.length} message(s)? The messages will be deleted from the current queue.`,
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
      
      // Refresh queue summary to reflect new message count
      toolbarRef.current?.refreshQueueDetails?.();
      
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
      
      // Refresh queue summary to reflect new message count
      toolbarRef.current?.refreshQueueDetails?.();
      
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
        <MessageListToolbar 
          ref={toolbarRef}
          sourceDefinition={sourceDefinition} 
          minTime={replayLogTimeRange.min} 
          maxTime={replayLogTimeRange.max} 
          onChange={handleBrowseFromChange}
          selectedMessages={selectedMessages}
          globalFilterValue={globalFilterValue}
          onFilterChange={handleFilterChange}
          onBulkCopy={handleBulkCopy}
          onBulkMove={handleBulkMove}
          onBulkDelete={handleBulkDelete}
          bulkOperationInProgress={bulkOperationInProgress}
        />
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
            stripedRows
            metaKeySelection={false}
            globalFilterFields={['filterField']}
            filters={filters}
            header={ListHeader}
            footer={ListFooter}
            loading={isLoading}
            emptyMessage="No messages to browse, Browsing not supported or allowed."
          >
            <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} />
            <Column body={messageStatus} />
            <Column field="meta.msgId" header="MsgID" />
            <Column field="headers.applicationMessageId" header="ApplicationMsgID" body ={(rowData) => rowData.headers?.applicationMessageId ?? 'Not Available' }/>
            <Column field="headers.applicationMessageType" header="ApplicationMsgType" body ={(rowData) => rowData.headers?.applicationMessageType ?? 'Not Available' } />
            <Column body={formatDateTime} header="SpoolTime" />
            <Column field="meta.attachmentSize" header="MsgSize(B)" />
          </DataTable>
        </div>
        <ConfirmDialog />
        <Toast ref={toast} position="top-right" />
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