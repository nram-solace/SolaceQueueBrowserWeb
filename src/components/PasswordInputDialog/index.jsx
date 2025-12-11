import { useState, useRef, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Password } from 'primereact/password';

export default function PasswordInputDialog({ 
  visible, 
  onHide, 
  onConfirm, 
  title = 'Enter Password',
  confirmLabel = 'Confirm',
  message = null,
  requireConfirm = false 
}) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const passwordInputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setPassword('');
      setConfirmPassword('');
      setError('');
      // Focus password input when dialog opens
      setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 100);
    }
  }, [visible]);

  const handleConfirm = () => {
    setError('');
    
    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    if (requireConfirm && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    onConfirm(password);
    setPassword('');
    setConfirmPassword('');
  };

  const handleCancel = () => {
    setPassword('');
    setConfirmPassword('');
    setError('');
    onHide();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const footer = (
    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
      <Button label="Cancel" outlined onClick={handleCancel} />
      <Button label={confirmLabel} onClick={handleConfirm} />
    </div>
  );

  return (
    <Dialog
      header={title}
      visible={visible}
      onHide={handleCancel}
      footer={footer}
      style={{ width: '400px' }}
      modal
    >
      {message && (
        <div style={{ marginBottom: '1rem', color: 'var(--text-color-secondary)' }}>
          {message}
        </div>
      )}
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Password
          ref={passwordInputRef}
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          feedback={false}
          toggleMask
          style={{ width: '100%' }}
          inputStyle={{ width: '100%' }}
          placeholder="Enter password"
        />

        {requireConfirm && (
          <Password
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            feedback={false}
            toggleMask
            style={{ width: '100%' }}
            inputStyle={{ width: '100%' }}
            placeholder="Confirm password"
          />
        )}

        {error && (
          <div style={{ color: 'var(--red-500)', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}
      </div>
    </Dialog>
  );
}
