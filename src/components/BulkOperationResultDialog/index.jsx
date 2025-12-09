import { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Accordion, AccordionTab } from 'primereact/accordion';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';

import classes from './styles.module.css';

export default function BulkOperationResultDialog({ 
  visible, 
  results, 
  operationType, 
  onClose 
}) {
  const [expandedErrors, setExpandedErrors] = useState(false);
  const [expandedPartialErrors, setExpandedPartialErrors] = useState(false);

  if (!results) {
    return null;
  }

  const { total, success, failed, partialFailures = 0, errors = [], partialErrors = [] } = results;
  const successRate = total > 0 ? Math.round((success / total) * 100) : 0;

  const getMessageId = (message) => {
    return message.meta?.msgId || 
           message.meta?.replicationGroupMsgId || 
           message.headers?.replicationGroupMsgId || 
           'Unknown';
  };

  const errorTableData = errors.map((item, index) => ({
    id: index,
    messageId: getMessageId(item.message),
    error: item.error
  }));

  const partialErrorTableData = partialErrors.map((item, index) => ({
    id: index,
    messageId: getMessageId(item.message),
    error: item.error
  }));

  const footer = (
    <div className={classes.footer}>
      <Button 
        label="Close" 
        icon="pi pi-check" 
        onClick={onClose}
        autoFocus
      />
    </div>
  );

  const operationText = operationType === 'delete' ? 'Deleted' : 
                        operationType === 'copy' ? 'Copied' : 
                        operationType === 'move' ? 'Moved' : 'Processed';

  return (
    <Dialog
      visible={visible}
      modal
      header="Operation Results"
      footer={footer}
      className={classes.dialog}
      onHide={onClose}
      style={{ width: '600px' }}
    >
      <div className={classes.content}>
        {/* Summary Statistics */}
        <div className={classes.summary}>
          <div className={classes.summaryRow}>
            <span className={classes.summaryLabel}>Total Messages:</span>
            <span className={classes.summaryValue}>{total}</span>
          </div>
          <div className={classes.summaryRow}>
            <span className={classes.summaryLabel}>Successfully {operationText}:</span>
            <span className={`${classes.summaryValue} ${classes.success}`}>{success}</span>
          </div>
          {failed > 0 && (
            <div className={classes.summaryRow}>
              <span className={classes.summaryLabel}>Failed:</span>
              <span className={`${classes.summaryValue} ${classes.error}`}>{failed}</span>
            </div>
          )}
          {partialFailures > 0 && (
            <div className={classes.summaryRow}>
              <span className={classes.summaryLabel}>Partial Failures:</span>
              <span className={`${classes.summaryValue} ${classes.warning}`}>{partialFailures}</span>
            </div>
          )}
          <div className={classes.summaryRow}>
            <span className={classes.summaryLabel}>Success Rate:</span>
            <span className={classes.summaryValue}>{successRate}%</span>
          </div>
        </div>

        {/* Error Details */}
        {(errors.length > 0 || partialErrors.length > 0) && (
          <Accordion multiple activeIndex={[0, 1]}>
            {errors.length > 0 && (
              <AccordionTab 
                header={
                  <div className={classes.accordionHeader}>
                    <span>Failed Messages ({errors.length})</span>
                    <i className="pi pi-exclamation-triangle text-red-500"></i>
                  </div>
                }
              >
                <div className={classes.errorTable}>
                  <DataTable 
                    value={errorTableData} 
                    size="small"
                    scrollable
                    scrollHeight="200px"
                  >
                    <Column field="messageId" header="Message ID" />
                    <Column field="error" header="Error" body={(rowData) => (
                      <div className={classes.errorMessage}>{rowData.error}</div>
                    )} />
                  </DataTable>
                </div>
              </AccordionTab>
            )}
            {partialErrors.length > 0 && (
              <AccordionTab 
                header={
                  <div className={classes.accordionHeader}>
                    <span>Partial Failures ({partialErrors.length})</span>
                    <i className="pi pi-exclamation-triangle text-orange-500"></i>
                  </div>
                }
              >
                <div className={classes.errorTable}>
                  <DataTable 
                    value={partialErrorTableData} 
                    size="small"
                    scrollable
                    scrollHeight="200px"
                  >
                    <Column field="messageId" header="Message ID" />
                    <Column field="error" header="Error" body={(rowData) => (
                      <div className={classes.errorMessage}>{rowData.error}</div>
                    )} />
                  </DataTable>
                </div>
              </AccordionTab>
            )}
          </Accordion>
        )}

        {/* Success Message */}
        {success === total && (
          <div className={`flex align-items-center gap-2 p-3 border-round ${classes.successMessage}`}>
            <i className="pi pi-check-circle text-green-500 text-2xl"></i>
            <span className="text-green-700 font-medium">All messages were successfully {operationText.toLowerCase()}.</span>
          </div>
        )}
      </div>
    </Dialog>
  );
}

