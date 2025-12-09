import { Dialog } from 'primereact/dialog';
import { ProgressBar } from 'primereact/progressbar';
import { Button } from 'primereact/button';

import classes from './styles.module.css';

export default function BulkOperationProgressDialog({ 
  visible, 
  progress, 
  status, 
  total, 
  current, 
  onCancel 
}) {
  const footer = (
    <div className={classes.footer}>
      <Button 
        label="Cancel" 
        icon="pi pi-times" 
        onClick={onCancel}
        severity="secondary"
        disabled={progress >= 100}
      />
    </div>
  );

  return (
    <Dialog
      visible={visible}
      modal
      header="Processing Messages"
      footer={footer}
      className={classes.dialog}
      closable={false}
      onHide={() => {}}
    >
      <div className={classes.content}>
        <div className={classes.statusText}>{status}</div>
        <ProgressBar value={progress} className={classes.progressBar} />
        <div className={classes.progressText}>
          {current} of {total} messages processed ({Math.round(progress)}%)
        </div>
      </div>
    </Dialog>
  );
}

