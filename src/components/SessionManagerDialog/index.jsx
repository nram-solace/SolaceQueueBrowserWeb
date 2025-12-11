import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toolbar } from 'primereact/toolbar';
import { Toast } from 'primereact/toast';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import PasswordInputDialog from '../PasswordInputDialog';

import classes from './styles.module.css';
import { useEffect, useState, useRef } from 'react';

export default function SessionManagerDialog({ sessionManager, onHide, visible }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordDialogConfig, setPasswordDialogConfig] = useState(null);
  const toast = useRef(null);

  useEffect(() => {
    if (visible) {
      loadSessions();
    }
  }, [visible]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const sessionList = await sessionManager.list();
      setSessions(sessionList);
    } catch (err) {
      console.error('Failed to load sessions:', err);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load sessions'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreSession = async (name) => {
    setLoading(true);
    try {
      const success = await sessionManager.restore(name);
      if (success) {
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: `Session "${name}" restored successfully`
        });
        onHide?.();
      } else {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to restore session'
        });
      }
    } catch (err) {
      console.error('Failed to restore session:', err);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to restore session'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreFromFile = async () => {
    setLoading(true);
    try {
      // Try to restore without password first (in case file is not encrypted)
      const result = await sessionManager.restoreFromFile(null);
      toast.current?.show({
        severity: 'success',
        summary: 'Success',
        detail: `Session "${result.sessionName}" restored from file (${result.brokerCount} broker${result.brokerCount !== 1 ? 's' : ''})`
      });
      await loadSessions(); // Refresh the list in case the session was added
      onHide?.();
    } catch (err) {
      console.error('Failed to restore session from file:', err);
      if (err.name === 'AbortError') {
        // User cancelled file picker - don't show error
        setLoading(false);
        return;
      }
      
      // If password is required, show password dialog
      if (err.requiresPassword || err.message.includes('Password is required') || err.message.includes('decrypt')) {
        const fileHandle = err.fileHandle || null;
        setPasswordDialogConfig({
          title: 'Enter Password',
          message: 'Please enter password to decrypt the session file',
          requireConfirm: false,
          onConfirm: (password) => handleRestoreFromFileWithPassword(password, fileHandle)
        });
        setShowPasswordDialog(true);
        setLoading(false);
        return;
      }
      
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: err.message || 'Failed to restore session from file'
      });
      setLoading(false);
    }
  };

  const handleRestoreFromFileWithPassword = async (password, fileHandle) => {
    setShowPasswordDialog(false);
    setLoading(true);
    try {
      // Call restore again with password and file handle (if available)
      const result = await sessionManager.restoreFromFile(password, fileHandle);
      toast.current?.show({
        severity: 'success',
        summary: 'Success',
        detail: `Session "${result.sessionName}" restored from file (${result.brokerCount} broker${result.brokerCount !== 1 ? 's' : ''})`
      });
      await loadSessions(); // Refresh the list in case the session was added
      onHide?.();
    } catch (err) {
      console.error('Failed to restore session from file:', err);
      if (err.name === 'AbortError') {
        // User cancelled file picker - don't show error
        return;
      }
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: err.message || 'Failed to restore session from file'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = (name) => {
    confirmDialog({
      message: `Are you sure you want to delete session "${name}"?`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      accept: async () => {
        setLoading(true);
        try {
          await sessionManager.delete(name);
          toast.current?.show({
            severity: 'success',
            summary: 'Success',
            detail: `Session "${name}" deleted`
          });
          await loadSessions();
        } catch (err) {
          console.error('Failed to delete session:', err);
          toast.current?.show({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to delete session'
          });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const actionBodyTemplate = (rowData) => {
    return (
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Button
          icon="pi pi-undo"
          severity="secondary"
          size="small"
          outlined
          onClick={() => handleRestoreSession(rowData.name)}
          tooltip="Restore session"
          tooltipOptions={{ position: 'top' }}
        />
        <Button
          icon="pi pi-trash"
          severity="danger"
          size="small"
          outlined
          onClick={() => handleDeleteSession(rowData.name)}
          tooltip="Delete session"
          tooltipOptions={{ position: 'top' }}
        />
      </div>
    );
  };

  const Footer = () => (
    <Toolbar
      end={
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button
            label="Restore from File"
            icon="pi pi-file-import"
            onClick={handleRestoreFromFile}
            loading={loading}
            outlined
            tooltip="Restore a session from a local JSON file"
            tooltipOptions={{ position: 'top' }}
          />
          <Button onClick={onHide}>Close</Button>
        </div>
      }
    />
  );

  return (
    <>
      <Dialog
        className={classes.sessionDialog}
        header="Session Manager"
        footer={Footer}
        visible={visible}
        onHide={onHide}
        style={{ width: '600px' }}
      >
        <Toast ref={toast} />
        <ConfirmDialog />
        
        <div className={classes.sessionsSection}>
          <h3>Saved Sessions</h3>
          <DataTable
            value={sessions}
            loading={loading}
            emptyMessage="No saved sessions"
            size="small"
            stripedRows
          >
            <Column field="name" header="Name" />
            <Column
              field="brokerCount"
              header="Brokers"
              style={{ width: '100px' }}
            />
            <Column
              field="savedAt"
              header="Saved At"
              body={(rowData) => formatDate(rowData.savedAt)}
              style={{ width: '200px' }}
            />
            <Column
              body={actionBodyTemplate}
              style={{ width: '120px' }}
            />
          </DataTable>
        </div>
      </Dialog>
      
      {passwordDialogConfig && (
        <PasswordInputDialog
          visible={showPasswordDialog}
          onHide={() => {
            setShowPasswordDialog(false);
            setPasswordDialogConfig(null);
          }}
          onConfirm={passwordDialogConfig.onConfirm}
          title={passwordDialogConfig.title}
          message={passwordDialogConfig.message}
          requireConfirm={passwordDialogConfig.requireConfirm}
        />
      )}
    </>
  );
}

