import { useState, useRef } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { transformToTableData } from '../../utils/messageTableData';
import { copyToClipboard } from '../../utils/clipboard';
import { showSuccessToast, showErrorToast } from '../../utils/toast';
import classes from './styles.module.css';

export default function MessageHeadersView({ message }) {
  const toast = useRef(null);
  const [copiedField, setCopiedField] = useState(null);

  if (!message || message === null || message === undefined) {
    return 'Please select a message.';
  }
  
  const { headers } = message;
  const tableData = transformToTableData(headers);

  // Fields that should have copy functionality
  const copyableFields = ['replicationGroupMsgId', 'guaranteedMessageId', 'correlationId', 'applicationMessageId', 'destination'];

  const handleCopy = async (fieldName, value) => {
    if (await copyToClipboard(value)) {
      setCopiedField(fieldName);
      showSuccessToast(toast, `Copied ${fieldName} to clipboard`, 'Copied', 2000);
      setTimeout(() => setCopiedField(null), 2000);
    } else {
      showErrorToast(toast, 'Failed to copy to clipboard', 'Copy Failed');
    }
  };

  const valueBodyTemplate = (rowData) => {
    const isCopyable = copyableFields.includes(rowData.name);
    const value = rowData.value;

    if (isCopyable && value && value !== 'undefined' && value !== 'null') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className={classes.valueCell}>{value}</span>
          <Button
            icon={copiedField === rowData.name ? 'pi pi-check' : 'pi pi-copy'}
            className="p-button-text p-button-sm"
            onClick={(e) => {
              e.stopPropagation();
              handleCopy(rowData.name, value);
            }}
            tooltip="Copy to clipboard"
            tooltipOptions={{ position: 'top' }}
            style={{ padding: '0.25rem', minWidth: 'auto', width: '1.5rem', height: '1.5rem' }}
          />
        </div>
      );
    }

    return <span className={classes.valueCell}>{value}</span>;
  };

  return (
    <>
      <DataTable 
        value={tableData} 
        size="small"
        scrollable
        scrollHeight="flex"
        stripedRows
        className={classes.messageTable}
        emptyMessage=""
      >
        <Column field="name" header="Header Property" style={{ width: '40%' }} />
        <Column field="value" header="Value" body={valueBodyTemplate} />
      </DataTable>
      <Toast ref={toast} position="top-right" />
    </>
  );
}
