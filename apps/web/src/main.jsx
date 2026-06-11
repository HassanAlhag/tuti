import React from "react";
import ReactDOM from "react-dom/client";
import { QueryProvider } from "@tuti/shared/providers/QueryProvider.jsx";
import App from "./App.jsx";
import "@tuti/shared/styles/tokens.css";
import "@tuti/shared/styles/base.css";
import "./styles/storefront.css";
import "./styles/client.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryProvider>
      <App />
    </QueryProvider>
  </React.StrictMode>
);
