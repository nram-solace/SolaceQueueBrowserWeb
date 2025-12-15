import { useState, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { FloatLabel } from 'primereact/floatlabel';
import { useSempApi } from '../../providers/SempClientProvider';
import { Toast } from 'primereact/toast';
import { useRef } from 'react';
import { getAllMsgVpnQueues } from '../../utils/solace/semp/paging';

import classes from './styles.module.css';

export default function QueueSelectionDialog({ visible, config, currentQueueName, onSelect, onHide }) {
  const [queues, setQueues] = useState([]);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const sempApi = useSempApi();
  const toast = useRef(null);
  const loadQueuesTokenRef = useRef(0);

  useEffect(() => {
    if (visible && config) {
      loadQueues();
    } else {
      setQueues([]);
      setSelectedQueue(null);
    }
  }, [visible, config]);

  const loadQueues = async () => {
    if (!config || !config.vpn) {
      return;
    }

    const loadToken = ++loadQueuesTokenRef.current;
    setIsLoading(true);
    try {
      const sempClient = sempApi.getClient(config);
      const queueList = await getAllMsgVpnQueues(sempClient, config.vpn, { select: ['queueName'] });
      // Filter out the current queue and system queues (starting with #)
      const filteredQueues = queueList
        .filter(queue => queue.queueName !== currentQueueName && !queue.queueName.startsWith('#'))
        .map(queue => ({
          label: queue.queueName,
          value: queue.queueName
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
      
      if (loadToken === loadQueuesTokenRef.current) {
        setQueues(filteredQueues);
      }
    } catch (err) {
      console.error('Error loading queues:', err);
      const errorDetail = err.response?.body?.meta?.error?.description || 
                         err.message || 
                         'Failed to load queues.';
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: errorDetail,
        life: 5000
      });
      if (loadToken === loadQueuesTokenRef.current) {
        setQueues([]);
      }
    } finally {
      if (loadToken === loadQueuesTokenRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleSelect = () => {
    if (selectedQueue) {
      onSelect?.(selectedQueue);
      setSelectedQueue(null);
    }
  };

  const handleHide = () => {
    setSelectedQueue(null);
    onHide?.();
  };

  const Footer = () => (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
      <Button outlined severity="secondary" onClick={handleHide}>Cancel</Button>
      <Button onClick={handleSelect} disabled={!selectedQueue || isLoading}>
        Select
      </Button>
    </div>
  );

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && visible) {
        handleHide();
      }
    };

    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [visible, handleHide]);

  return (
    <Dialog
      className={classes.queueSelectionDialog}
      header="Select Destination Queue"
      footer={Footer}
      visible={visible}
      onHide={handleHide}
      style={{ width: '32rem' }}
    >
      <Toast ref={toast} />
      <div className={classes.formField}>
        <FloatLabel>
          <Dropdown
            id="destinationQueue"
            value={selectedQueue}
            onChange={(e) => setSelectedQueue(e.value)}
            options={queues}
            optionLabel="label"
            optionValue="value"
            placeholder="Select a queue"
            className={classes.dropdown}
            loading={isLoading}
            disabled={isLoading}
            filter
            filterPlaceholder="Search queues"
          />
          <label htmlFor="destinationQueue">Destination Queue</label>
        </FloatLabel>
        {queues.length === 0 && !isLoading && (
          <div className={classes.emptyMessage}>
            No available queues found. Make sure you have access to other queues in this VPN.
          </div>
        )}
      </div>
    </Dialog>
  );
}

