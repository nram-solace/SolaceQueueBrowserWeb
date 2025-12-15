import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

import { Toolbar } from 'primereact/toolbar';
import { Button } from 'primereact/button';
import { PrimeIcons } from 'primereact/api';

import classes from './styles.module.css';
import { useEffect, useState } from "react";
import { APP_TITLE, WINDOW_TITLE } from '../../config/version';
import BrandLogo from '../BrandLogo';

export default function TitleBar() {
  useEffect(() => {
    // Set Tauri window title dynamically
    if (window.top?.__TAURI__) {
      const appWindow = getCurrentWebviewWindow();
      appWindow.setTitle(WINDOW_TITLE);
    }
  }, []);

  const AppTitle = () => {
    return (
      <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '0.5em' }}>
        <BrandLogo size="small" variant="auto" />
        <span style={{ paddingLeft: '0.5em' }}>{APP_TITLE}</span>
      </div>
    )
  }

  const ControlButtons = () => {
    const appWindow = getCurrentWebviewWindow();
    const [isMaximized, setIsMaximized] = useState(false);

    const minimizeWindow = () => {
      appWindow.minimize();
    };
  
    const restoreWindow = () => {
      setIsMaximized(false);
      appWindow.unmaximize();
    };
  
    const maximizeWindow = () => {
      setIsMaximized(true);
      appWindow.maximize();
    };
  
    const closeWindow = () => {
      appWindow.close();
    };

    useEffect(() => {
      appWindow.isMaximized().then(setIsMaximized);
      appWindow.onResized(() => {
        appWindow.isMaximized().then(setIsMaximized);
      });
    }, []);

    return (
      <>
        <Button text icon={PrimeIcons.MINUS} onClick={minimizeWindow} />
        { 
          isMaximized ? 
          <Button text icon={PrimeIcons.WINDOW_MINIMIZE} onClick={restoreWindow} /> :
          <Button text icon={PrimeIcons.WINDOW_MAXIMIZE} onClick={maximizeWindow} />        
        }
        <Button text icon={PrimeIcons.TIMES} onClick={closeWindow} />
      </>
    )
  };

  return (
    <Toolbar className={classes.toolbar} data-tauri-drag-region
      start={AppTitle}
      end={window.top.__TAURI__ ? ControlButtons : null} />
  );
}
