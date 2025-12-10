import classes from './styles.module.css';
import JsonView from 'react18-json-view';
import 'react18-json-view/src/style.css';

export default function MessageUserPropertiesView({ message }) {
  if (!message || message === null || message === undefined) {
    return 'Please select a message.';
  }
  
  const { userProperties } = message;
  return (
    <JsonView src={userProperties || {}} theme="atom" dark="false" />
  )
}
