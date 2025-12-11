import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toolbar } from 'primereact/toolbar';
import { FloatLabel } from 'primereact/floatlabel';
import { InputText } from 'primereact/inputtext';
import { Toast } from 'primereact/toast';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';

import classes from './styles.module.css';
import { useEffect, useState, useRef } from 'react';

export default function SessionManagerDialog({ sessionManager, onHide, visible }) {
  const [sessions, setSessions] = useState([]);
  const [sessionName, setSessionName] = useState('');
  const [loading, setLoading] = useState(false);
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

  const handleSaveSession = async () => {
    if (!sessionName.trim()) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Validation',
        detail: 'Please enter a session name'
      });
      return;
    }

    setLoading(true);
    try {
      await sessionManager.save(sessionName.trim());
      toast.current?.show({
        severity: 'success',
        summary: 'Success',
        detail: `Session "${sessionName.trim()}" saved successfully`
      });
      setSessionName('');
      await loadSessions();
    } catch (err) {
      console.error('Failed to save session:', err);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to save session'
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
        <Button onClick={onHide}>Close</Button>
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
        
        <div className={classes.saveSection}>
          <h3 style={{ marginTop: 0 }}>Save Current Session</h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <FloatLabel style={{ flex: 1 }}>
              <InputText
                id="sessionName"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveSession();
                  }
                }}
              />
              <label htmlFor="sessionName">Session Name</label>
            </FloatLabel>
            <Button
              label="Save"
              icon="pi pi-save"
              onClick={handleSaveSession}
              loading={loading}
            />
          </div>
        </div>

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
    </>
  );
}

