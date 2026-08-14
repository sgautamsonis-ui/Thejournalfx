import React, { createContext, useContext, useState } from "react";

// Lets an individual page (e.g. Dashboard's "Customize" button) render a
// control inside the shared header in Layout.jsx, without Layout needing to
// know about every page's page-specific actions. The page calls
// setHeaderAction(<button .../>) on mount and setHeaderAction(null) on
// unmount, so the control disappears automatically when navigating away.
const HeaderActionsContext = createContext({
  headerAction: null,
  setHeaderAction: () => {},
});

export function HeaderActionsProvider({ children }) {
  const [headerAction, setHeaderAction] = useState(null);
  return (
    <HeaderActionsContext.Provider value={{ headerAction, setHeaderAction }}>
      {children}
    </HeaderActionsContext.Provider>
  );
}

export function useHeaderActions() {
  return useContext(HeaderActionsContext);
}
