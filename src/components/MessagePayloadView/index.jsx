import { useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import classes from './styles.module.css';
import JsonView from 'react18-json-view';
import 'react18-json-view/src/style.css'
import { BINARY_PAYLOAD_NOT_AVAILABLE } from '../../hooks/solace';
import { copyToClipboard } from '../../utils/clipboard';
import { showSuccessToast, showErrorToast } from '../../utils/toast';
import PropTypes from 'prop-types';

export default function MessagePayloadView({ message }) {
  const toast = useRef(null);
  const [copied, setCopied] = useState(false);
  const messageUndefined = message === undefined;
  const payloadUndefined = message?.payload === undefined;
  const isBinaryPayloadNotAvailable = message?.payload === BINARY_PAYLOAD_NOT_AVAILABLE;
  
  const handleCopyPayload = async () => {
    const payload = message?.payload;
    if (!payload || payload === BINARY_PAYLOAD_NOT_AVAILABLE) {
      showErrorToast(toast, 'Payload not available to copy', 'Copy Failed');
      return;
    }

    // For JSON payloads, copy the stringified version
    let textToCopy = payload;
    if (typeof payload === 'string') {
      try {
        // If it's valid JSON, format it nicely
        const parsed = JSON.parse(payload);
        textToCopy = JSON.stringify(parsed, null, 2);
      } catch (e) {
        // Not JSON, use as-is
        textToCopy = payload;
      }
    } else {
      textToCopy = JSON.stringify(payload, null, 2);
    }

    if (await copyToClipboard(textToCopy)) {
      setCopied(true);
      showSuccessToast(toast, 'Copied payload to clipboard', 'Copied', 2000);
      setTimeout(() => setCopied(false), 2000);
    } else {
      showErrorToast(toast, 'Failed to copy payload to clipboard', 'Copy Failed');
    }
  };
 
  function isJson(payload){
     try{
        JSON.parse(payload);
        return true;
     }catch(e){
        return false;
     }
  }

  if (messageUndefined) {
    return 'Please select a message.';
  }
  
  if (payloadUndefined) {
    return '';
  }
  
  if (isBinaryPayloadNotAvailable) {
    return <div className={classes.binaryPayloadMessage}>Binary payload - not displayed</div>;
  }
  
  const renderCopyButton = () => {
    if (payloadUndefined || isBinaryPayloadNotAvailable) {
      return null;
    }

    return (
      <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', zIndex: 10 }}>
        <Button
          icon={copied ? 'pi pi-check' : 'pi pi-copy'}
          className="p-button-text p-button-sm"
          onClick={handleCopyPayload}
          tooltip="Copy payload to clipboard"
          tooltipOptions={{ position: 'left' }}
          style={{ padding: '0.5rem' }}
        />
      </div>
    );
  };

  if (isJson(message?.payload)) {
    return (
      <>
        <div className={classes.jsonViewContainer} style={{ position: 'relative' }}>
          {renderCopyButton()}
          <JsonView src={JSON.parse(message?.payload)} theme="atom" dark="false" />
        </div>
        <Toast ref={toast} position="top-right" />
      </>
    );
  }
  
  return (
    <>
      <div className={classes.payloadContainer} style={{ position: 'relative' }}>
        {renderCopyButton()}
        <pre className={classes.wrapText}>{message?.payload || ''}</pre>
      </div>
      <Toast ref={toast} position="top-right" />
    </>
  );
}

MessagePayloadView.propTypes = {
  message: PropTypes.object
};