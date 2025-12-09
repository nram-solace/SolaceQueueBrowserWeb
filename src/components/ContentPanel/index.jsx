import { Panel } from 'primereact/panel';

import classes from './styles.module.css';

export default function ContentPanel({ title, toolbar, footer, children, headerPrefix }) {

  const headerTemplate = (options) => {
    return (
      <div className={options.className} style={{ display: 'flex', flexDirection: 'column' }}>
        {headerPrefix && <div className={classes.headerPrefix}>{headerPrefix}</div>}
        <div className={classes.headerRow}>
          <div>
            <strong>{title}</strong>
          </div>
          <div>
            {toolbar}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Panel headerTemplate={headerTemplate} 
    pt={{ 
      root: { className: classes.panelRoot },
      header: { className: classes.panelHeader },
      toggleableContent: { className: classes.panelOuterContent }, 
      content: { className: classes.panelInnerContent }}}>
      {children}
    </Panel>
  );
}