import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import { QueryProvider } from "@tuti/shared/providers/QueryProvider.jsx";
import App from "./App.jsx";
import { AppErrorBoundary } from "./AppErrorBoundary.jsx";
import "@tuti/shared/styles/tokens.css";
import "@tuti/shared/styles/base.css";
import "./styles/customer/index.css";
import "./styles/storefront.css";
import "./styles/client.css";

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <QueryProvider>
        <App />
      </QueryProvider>
    </AppErrorBoundary>
  </React.StrictMode>
);
