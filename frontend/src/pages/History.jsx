import { useState, useEffect, useMemo } from "react";
import { fetchHistory } from "../api/api";

export default function History() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("All");

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHistory();
      setEntries(data);
    } catch (err) {
      console.error("Failed to load history:", err);
      setError(err.message || "Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
    
    // Listen for dataUpdated event to refresh history
    const handler = () => loadHistory();
    window.addEventListener("dataUpdated", handler);
    
    return () => {
      window.removeEventListener("dataUpdated", handler);
    };
  }, []);

  // Format date to local readable format
  function formatDate(dateStr) {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr + "T00:00:00");
      return date.toLocaleDateString("en-US", { 
        year: "numeric", 
        month: "short", 
        day: "numeric" 
      });
    } catch {
      return dateStr;
    }
  }

  // Get display area from entry
  function getDisplayArea(entry) {
    return entry.area || "";
  }

  // Filter entries - ALWAYS display only Warehouse, Sent to Shop, Shop (same allowed set as backend)
  const filteredEntries = useMemo(() => {
    // Hard filter: only allow Warehouse, Sent to Shop, Shop
    const allowed = new Set(["Warehouse", "Sent to Shop", "Shop"]);
    let filtered = entries.filter(h => allowed.has(h.area));
    
    // Then filter by selected type filter
    if (filter !== "All") {
      const filterMap = {
        "Warehouse": "Warehouse",
        "Sent to Shop": "Sent to Shop",
        "Shop": "Shop"
      };
      const filterArea = filterMap[filter];
      filtered = filtered.filter(entry => entry.area === filterArea);
    }
    
    return filtered;
  }, [entries, filter]);

  if (loading) {
    return (
      <div className="card">
        <h2>History</h2>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2>History</h2>
        <div className="message error">{error}</div>
        <button className="btn primary" onClick={loadHistory}>Retry</button>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>History</h2>
      
      <div style={{ display: "flex", gap: "20px", marginBottom: "20px", flexWrap: "wrap" }}>
        <div className="field" style={{ maxWidth: "300px" }}>
          <label className="label">Filter by Type</label>
          <select
            className="input"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="All">All</option>
            <option value="Warehouse">Warehouse (Produced)</option>
            <option value="Sent to Shop">Sent to Shop</option>
            <option value="Shop">Shop</option>
          </select>
        </div>
      </div>
      
      {filteredEntries.length === 0 ? (
        <p>No entries found{filter !== "All" ? ` for ${filter}` : ""}.</p>
      ) : (
        <div className="table-scroll">
          <div className="tableWrap">
            <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Area</th>
                <th>Product</th>
                <th>Action</th>
                <th>Qty</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry, index) => {
                return (
                  <tr key={index}>
                    <td>{formatDate(entry.date)}</td>
                    <td>{getDisplayArea(entry)}</td>
                    <td>{entry.product || ""}</td>
                    <td></td>
                    <td>{entry.qty ?? 0}</td>
                    <td>{entry.notes || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  );
}
