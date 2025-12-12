import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Providers from "./providers";

// Filter out specific Solace library error messages
const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args.join(' ');
  // Suppress "Invalid state: expected 'opening', current value 'closing'" errors
  // These can come from either [HL 1979] (Solace library) or [BasicQueueBrowser XXXX] (app code)
  if (message.includes('Invalid state') && 
      message.includes("expected 'opening'") && 
      message.includes("current value 'closing'")) {
    return; // Suppress this specific error
  }
  originalConsoleError.apply(console, args);
};

ReactDOM.createRoot(document.getElementById("app")).render(
  <React.StrictMode>
    <Providers>
      <App />
    </Providers>
  </React.StrictMode>,
);
