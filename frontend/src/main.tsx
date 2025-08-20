import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ThemeProvider } from "./components/theme/theme-provider";
import { Toaster } from "./components/ui/sonner";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider defaultTheme="system" storageKey="gemini-ui-theme">
        <App />
        <Toaster />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
