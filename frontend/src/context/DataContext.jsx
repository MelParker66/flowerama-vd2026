import { createContext, useContext, useState, useEffect } from "react";

const DataContext = createContext();

export function DataProvider({ children }) {
  const [summaryData, setSummaryData] = useState({ totals: {}, byProduct: {} });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refreshSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiBase = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? "" : "http://localhost:3001");
      const response = await fetch(`${apiBase}/api/dashboard`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (data.ok) {
        setSummaryData({
          totals: data.totals || {},
          byProduct: data.byProduct || {}
        });
      }
    } catch (err) {
      console.warn("Failed to fetch dashboard:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSummary();
    
    // Listen for dataUpdated event to refresh summary
    const handler = () => refreshSummary();
    window.addEventListener("dataUpdated", handler);
    
    return () => {
      window.removeEventListener("dataUpdated", handler);
    };
  }, []);

  return (
    <DataContext.Provider value={{ summaryData, refreshSummary, loading, error }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within DataProvider");
  }
  return context;
}




