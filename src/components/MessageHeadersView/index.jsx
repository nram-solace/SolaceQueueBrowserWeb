import classes from './styles.module.css';
import JsonView from 'react18-json-view';
import 'react18-json-view/src/style.css';

export default function MessageHeadersView({ message }) {
  if (!message || message === null || message === undefined) {
    return 'Please select a message.';
  }
  
  const { headers } = message;
  return (
    <JsonView src={headers || {}} theme="atom" dark="false" />
  )
}
