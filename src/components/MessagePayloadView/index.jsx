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

  return (
    messageUndefined ? 'Please select a message.' :
      payloadUndefined ? 'Payload unavailable.' :
      isBinaryPayloadNotAvailable ? <div className={classes.binaryPayloadMessage}>Binary payload - not displayed</div> :
      isJson (message?.payload) ? <JsonView src={JSON.parse(message?.payload)} theme="atom" dark="false" />  :
    <pre className={classes.wrapText}>{message?.payload || ''}</pre>
  )
}