import classes from './styles.module.css';
import JsonView from 'react18-json-view';
import 'react18-json-view/src/style.css';

export default function MessageMetaView({ message }) {
  if (!message || message === null || message === undefined) {
    return 'Please select a message.';
  }
  
  const { meta } = message;
  return (
    <JsonView src={meta || {}} theme="atom" dark="false" />
  )
}
