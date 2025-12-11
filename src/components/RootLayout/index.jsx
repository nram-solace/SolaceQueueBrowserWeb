import React from 'react';

import { Splitter, SplitterPanel } from 'primereact/splitter';
import { Panel } from 'primereact/panel';
import classes from './styles.module.css';

function BasePanel({ header, children }) {
  return <Panel 
    header={header}
    pt={{ 
      root: { className: classes.panelRoot },
      header: { className: classes.panelHeader },
      toggleableContent: { className: classes.panelOuterContent }, 
      content: { className: classes.panelInnerContent }}}
    >
      {children}
    </Panel>
}

const LeftPanel = (props) => props.children;
const CenterPanel = (props) => props.children;
const RightPanel1 = (props) => BasePanel(props);
const RightPanel2 = (props) => BasePanel(props);
const RightPanel3 = (props) => BasePanel(props);
const RightPanel4 = (props) => BasePanel(props);

function RootLayout({ children }) {
  const nodes = React.Children.toArray(children);

  const leftPanel = nodes.find(node => node.type === LeftPanel);
  const centerPanel = nodes.find(node => node.type === CenterPanel);
  const rightPanel1 = nodes.find(node => node.type === RightPanel1);
  const rightPanel2 = nodes.find(node => node.type === RightPanel2);
  const rightPanel3 = nodes.find(node => node.type === RightPanel3);
  const rightPanel4 = nodes.find(node => node.type === RightPanel4);
    
  return (
    <Splitter className="h-full">
      <SplitterPanel size={20}>{leftPanel}</SplitterPanel>
      <SplitterPanel size={50}>{centerPanel}</SplitterPanel>
      <SplitterPanel size={30}>
        <Splitter style={{ height: '100%', width: '100%' }} layout="vertical">
          <SplitterPanel size={50}>
            {rightPanel1}
          </SplitterPanel>
          <SplitterPanel size={20}>
            {rightPanel2}
          </SplitterPanel>
          <SplitterPanel size={15}>
            {rightPanel3}
          </SplitterPanel>
          <SplitterPanel size={15}>
            {rightPanel4}
          </SplitterPanel>
        </Splitter>
      </SplitterPanel>
    </Splitter>
  );
}

Object.assign(RootLayout, { LeftPanel, CenterPanel, RightPanel1, RightPanel2, RightPanel3, RightPanel4 });

export default RootLayout;