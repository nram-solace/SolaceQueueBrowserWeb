import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { transformToTableData } from '../../utils/messageTableData';
import classes from './styles.module.css';

export default function MessageUserPropertiesView({ message }) {
  if (!message || message === null || message === undefined) {
    return 'Please select a message.';
  }
  
  const { userProperties } = message;
  const tableData = transformToTableData(userProperties);

  if (tableData.length === 0) {
    return <div className={classes.emptyMessage}>No user properties available.</div>;
  }

  return (
    <DataTable 
      value={tableData} 
      size="small"
      scrollable
      scrollHeight="flex"
      className={classes.messageTable}
    >
      <Column field="name" header="Property" style={{ width: '40%' }} />
      <Column field="value" header="Value" body={(rowData) => (
        <span className={classes.valueCell}>{rowData.value}</span>
      )} />
    </DataTable>
  );
}
