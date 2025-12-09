import { useEffect } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import TitleBar from "../TitleBar";
import { WINDOW_TITLE } from "../../config/version";

export default function DesktopContainer() {
  useEffect(() => {
    // Set Tauri window title when desktop container mounts
    if (window.top?.__TAURI__) {
      const appWindow = getCurrentWebviewWindow();
      appWindow.setTitle(WINDOW_TITLE);
    }
  }, []);

  return (
    <>
      <TitleBar />
      <iframe src="./"></iframe>
    </>
  );
}