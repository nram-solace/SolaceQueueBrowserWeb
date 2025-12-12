import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

import { Toolbar } from 'primereact/toolbar';
import { Button } from 'primereact/button';
import { PrimeIcons } from 'primereact/api';

import classes from './styles.module.css';
import { useEffect, useState } from "react";
import { APP_TITLE, WINDOW_TITLE } from '../../config/version';

export default function TitleBar() {
  // Initialize theme state from HTML - check which theme is currently active
  const getInitialTheme = () => {
    const darkTheme = window.document.getElementById('theme-dark');
    return darkTheme?.rel === 'stylesheet' ? 'dark' : 'light';
  };

  const [colorScheme, setColorScheme] = useState(() => getInitialTheme());

  const isColorSchemeDark = () => colorScheme === 'dark';

  useEffect(() => {
    // Set Tauri window title dynamically
    if (window.top?.__TAURI__) {
      const appWindow = getCurrentWebviewWindow();
      appWindow.setTitle(WINDOW_TITLE);
    }
  }, []);

  const toggleTheme = () => {
    setColorScheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      window.document.getElementById(`theme-${prev}`).rel = 'prefetch';
      window.document.getElementById(`theme-${next}`).rel = 'stylesheet';
      const contentFrame = window.document.querySelector('iframe');
      if(contentFrame) {
        contentFrame.contentDocument.getElementById(`theme-${prev}`).rel = 'prefetch';
        contentFrame.contentDocument.getElementById(`theme-${next}`).rel = 'stylesheet';
      }
      return next;
    });
  };

  const AppTitle = () => {
    return (
      <>
        <span style={{ paddingLeft: '1em' }}>{APP_TITLE}</span>
      </>
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
        <Button text icon={isColorSchemeDark() ? PrimeIcons.SUN : PrimeIcons.MOON} onClick={toggleTheme} />
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
      end={window.top.__TAURI__ ? ControlButtons : <Button text icon={isColorSchemeDark() ? PrimeIcons.SUN : PrimeIcons.MOON} onClick={toggleTheme} />} />
  );
}