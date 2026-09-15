import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IconContext } from "@phosphor-icons/react";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

// Brand spec: every icon in the app renders in Phosphor's "fill" weight.
// Setting it once here (rather than per-icon) also covers icons rendered
// indirectly through a stored reference (e.g. `<item.icon />` in nav/tile
// lists), which a per-callsite `weight="fill"` prop would miss.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <IconContext.Provider value={{ weight: "fill" }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </IconContext.Provider>
  </React.StrictMode>,
);
