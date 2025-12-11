import classes from './styles.module.css';
import JsonView from 'react18-json-view';
import 'react18-json-view/src/style.css'
import { BINARY_PAYLOAD_NOT_AVAILABLE } from '../../hooks/solace';

export default function MessagePayloadView({ message }) {
  const messageUndefined = message === undefined;
  const payloadUndefined = message?.payload === undefined;
  const isBinaryPayloadNotAvailable = message?.payload === BINARY_PAYLOAD_NOT_AVAILABLE;
 
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
  
  if (isJson(message?.payload)) {
    return (
      <div className={classes.jsonViewContainer}>
        <JsonView src={JSON.parse(message?.payload)} theme="atom" dark="false" />
      </div>
    );
  }
  
  return (
    <div className={classes.payloadContainer}>
      <pre className={classes.wrapText}>{message?.payload || ''}</pre>
    </div>
  );
}