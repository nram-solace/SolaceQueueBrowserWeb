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

import MessageListToolbar from './MessageListToolbar';
import { ActionApiClient } from '../../utils/solace/semp/actionApi';
import { SOURCE_TYPE } from '../../hooks/solace';
import QueueSelectionDialog from '../QueueSelectionDialog';

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
  const [queueDialogVisible, setQueueDialogVisible] = useState(false);
  const [pendingOperation, setPendingOperation] = useState(null); // 'copy' or 'move'
  const [pendingMessage, setPendingMessage] = useState(null);

  const loadMessages = async (loader) => {
    setIsLoading(true);
    try {
      setMessages(await loader());
    } catch (err) {
      console.error('Error loding messages', err);
      setMessages([]); // TODO: also show error toast notification?
    }
    setIsLoading(false);
  };

  useEffect(() => {
    browser.getReplayTimeRange().then(range => setReplayLogTimeRange(range));
    setMessages([]);
    loadMessages(() => browser.getFirstPage());
  }, [browser]);

  const handleRowSelection = (e) => {
    if (e.value !== null) {
      onMessageSelect?.(e.value);
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

  const ListHeader = () => {
    return (
      <div className="flex justify-content-end">
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

  return (
    (sourceName) ? (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
        <MessageListToolbar sourceDefinition={sourceDefinition} minTime={replayLogTimeRange.min} maxTime={replayLogTimeRange.max} onChange={onBrowseFromChange} />
        <div style={{ flex: '1', overflow: 'hidden' }}>
          <DataTable
            className={classes.messageListTable}
            value={messages.map(addFilterField)}
            size="small"
            scrollable
            resizableColumns
            selectionMode="single"
            selection={selectedMessage}
            dataKey="meta.replicationGroupMsgId"
            onSelectionChange={handleRowSelection}
            globalFilterFields={['filterField']}
            filters={filters}
            header={ListHeader}
            footer={ListFooter}
            loading={isLoading}
            emptyMessage="No messages available"
          >
            <Column body={messageStatus} />
            <Column field="meta.msgId" header="Message ID" />
            <Column field="headers.applicationMessageId" header="Application Message ID" body ={(rowData) => rowData.headers?.applicationMessageId ?? 'Not Available' }/>
            <Column field="headers.applicationMessageType" header="Application Message Type" body ={(rowData) => rowData.headers?.applicationMessageType ?? 'Not Available' } />
            <Column body={formatDateTime} header="Spooled Time" />
            <Column field="meta.attachmentSize" header="Attachment Size (B)" />
            <Column body={actionButtonsBody} header="Actions" style={{ width: (type === SOURCE_TYPE.QUEUE || type === SOURCE_TYPE.BASIC) ? '180px' : '80px' }} />
          </DataTable>
        </div>
        <ConfirmDialog />
        <Toast ref={toast} />
        <QueueSelectionDialog
          visible={queueDialogVisible}
          config={config}
          currentQueueName={sourceName}
          onSelect={handleQueueSelected}
          onHide={() => {
            setQueueDialogVisible(false);
            setPendingMessage(null);
            setPendingOperation(null);
          }}
        />
      </div>
    ) : (
      <div style={{ margin: '1em' }}>Please select a queue or topic to browse.</div>
    )
  );
}