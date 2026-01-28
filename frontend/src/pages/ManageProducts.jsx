import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAllProducts, deactivateProduct, reactivateProduct } from "../api/api";
import { useData } from "../context/DataContext";

const CORRECT_PIN = "1232";

export default function ManageProducts() {
  const navigate = useNavigate();
  const [pinVerified, setPinVerified] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const { refreshAll } = useData();

  // PIN gate: check on every mount (when tab is entered)
  useEffect(() => {
    setPinVerified(false);
    setPinInput("");
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllProducts();
      // Sort alphabetically by product name
      const sorted = data.sort((a, b) => 
        a.product.localeCompare(b.product, undefined, { sensitivity: 'base' })
      );
      setProducts(sorted);
    } catch (err) {
      console.error("Failed to load products:", err);
      setError(err.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only load products if PIN is verified
    if (pinVerified) {
      loadProducts();
      
      // Listen for dataUpdated event to refresh
      const handler = () => loadProducts();
      window.addEventListener("dataUpdated", handler);
      
      return () => {
        window.removeEventListener("dataUpdated", handler);
      };
    }
  }, [pinVerified]);

  const handleDeactivate = async (productName) => {
    if (!window.confirm(`Are you sure you want to deactivate "${productName}"? This will remove it from the Dashboard and form dropdowns.`)) {
      return;
    }

    setMessage({ type: "", text: "" });
    try {
      await deactivateProduct(productName);
      setMessage({ 
        type: "success", 
        text: `"${productName}" has been deactivated.` 
      });
      await loadProducts();
      // refreshAll() triggers dashboard refresh after deactivate
      await refreshAll();
      window.dispatchEvent(new Event("dataUpdated"));
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (err) {
      console.error("Deactivate failed:", err);
      setMessage({ 
        type: "error", 
        text: err.message || "Failed to deactivate product. Please try again." 
      });
    }
  };

  const handleReactivate = async (productName) => {
    setMessage({ type: "", text: "" });
    try {
      await reactivateProduct(productName);
      setMessage({ 
        type: "success", 
        text: `"${productName}" has been reactivated.` 
      });
      await loadProducts();
      // refreshAll() triggers dashboard refresh after deactivate
      await refreshAll();
      window.dispatchEvent(new Event("dataUpdated"));
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (err) {
      console.error("Reactivate failed:", err);
      setMessage({ 
        type: "error", 
        text: err.message || "Failed to reactivate product. Please try again." 
      });
    }
  };

  const handleBulkDeactivate = async () => {
    const selectedArray = Array.from(selectedProducts);
    if (selectedArray.length === 0) {
      setMessage({ 
        type: "error", 
        text: "Please select at least one product to deactivate." 
      });
      return;
    }

    if (!window.confirm(`Are you sure you want to deactivate ${selectedArray.length} product(s)? This will remove them from the Dashboard and form dropdowns.`)) {
      return;
    }

    setMessage({ type: "", text: "" });
    const errors = [];
    let successCount = 0;

    try {
      // Deactivate each selected product
      for (const productName of selectedArray) {
        try {
          await deactivateProduct(productName);
          successCount++;
        } catch (err) {
          console.error(`Failed to deactivate ${productName}:`, err);
          errors.push(productName);
        }
      }

      // Reload products and refresh dashboard
      await loadProducts();
      await refreshAll();
      window.dispatchEvent(new Event("dataUpdated"));

      // Show success/error message
      if (errors.length === 0) {
        setMessage({ 
          type: "success", 
          text: `${successCount} product(s) have been deactivated.` 
        });
      } else {
        setMessage({ 
          type: "error", 
          text: `${successCount} product(s) deactivated. Failed to deactivate: ${errors.join(", ")}` 
        });
      }

      // Clear selection and exit bulk mode
      setSelectedProducts(new Set());
      setBulkMode(false);
      
      setTimeout(() => setMessage({ type: "", text: "" }), 5000);
    } catch (err) {
      console.error("Bulk deactivate failed:", err);
      setMessage({ 
        type: "error", 
        text: err.message || "Failed to deactivate products. Please try again." 
      });
    }
  };

  const handleToggleSelect = (productName) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productName)) {
      newSelected.delete(productName);
    } else {
      newSelected.add(productName);
    }
    setSelectedProducts(newSelected);
  };

  const handleSelectAll = () => {
    // Only select active products
    const activeProducts = products.filter(p => p.active).map(p => p.product);
    if (selectedProducts.size === activeProducts.length) {
      // Deselect all
      setSelectedProducts(new Set());
    } else {
      // Select all active
      setSelectedProducts(new Set(activeProducts));
    }
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput === CORRECT_PIN) {
      setPinVerified(true);
    } else {
      alert("Incorrect code");
      navigate("/");
    }
  };

  // PIN gate: show PIN prompt if not verified
  if (!pinVerified) {
    return (
      <div className="card">
        <h2>Manage Products</h2>
        <form onSubmit={handlePinSubmit} style={{ marginTop: "20px" }}>
          <div className="field">
            <label className="label">Enter manager code</label>
            <input
              type="password"
              className="input"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              autoFocus
              style={{ maxWidth: "200px" }}
            />
          </div>
          <button type="submit" className="btn primary" style={{ marginTop: "10px" }}>
            Submit
          </button>
        </form>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card">
        <h2>Manage Products</h2>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2>Manage Products</h2>
        <div className="message error">{error}</div>
        <button className="btn primary" onClick={loadProducts}>Retry</button>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ margin: 0 }}>Manage Products</h2>
        {!bulkMode ? (
          <button
            className="btn danger"
            onClick={() => setBulkMode(true)}
            style={{ padding: "8px 16px", fontSize: "14px" }}
          >
            Bulk Deactivate
          </button>
        ) : (
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              className="btn primary"
              onClick={handleBulkDeactivate}
              style={{ padding: "8px 16px", fontSize: "14px" }}
              disabled={selectedProducts.size === 0}
            >
              Deactivate Selected ({selectedProducts.size})
            </button>
            <button
              className="btn"
              onClick={() => {
                setBulkMode(false);
                setSelectedProducts(new Set());
              }}
              style={{ padding: "8px 16px", fontSize: "14px", background: "#6b7280", color: "#fff" }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
      
      {message.text && (
        <div className={`message ${message.type === "success" ? "success" : "error"}`}>
          {message.text}
        </div>
      )}
      
      {products.length === 0 ? (
        <p>No products found.</p>
      ) : (
        <div className="table-scroll">
          <div className="tableWrap">
            <table className="table">
            <thead>
              <tr>
                {bulkMode && (
                  <th style={{ width: "40px" }}>
                    <input
                      type="checkbox"
                      checked={products.filter(p => p.active).length > 0 && 
                               selectedProducts.size === products.filter(p => p.active).length}
                      onChange={handleSelectAll}
                      style={{ cursor: "pointer" }}
                    />
                  </th>
                )}
                <th>Product</th>
                <th className="col-num col-planned">Planned</th>
                <th>Active</th>
                {!bulkMode && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.product}>
                  {bulkMode && (
                    <td>
                      {product.active ? (
                        <input
                          type="checkbox"
                          checked={selectedProducts.has(product.product)}
                          onChange={() => handleToggleSelect(product.product)}
                          style={{ cursor: "pointer" }}
                        />
                      ) : (
                        <span style={{ color: "#9ca3af" }}>—</span>
                      )}
                    </td>
                  )}
                  <td className="col-product">{product.product}</td>
                  <td className="col-num col-planned">{product.planned ?? 0}</td>
                  <td>{product.active ? "Yes" : "No"}</td>
                  {!bulkMode && (
                    <td>
                      {product.active ? (
                        <button
                          className="btn danger"
                          onClick={() => handleDeactivate(product.product)}
                          style={{ padding: "6px 12px", fontSize: "14px" }}
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          className="btn primary"
                          onClick={() => handleReactivate(product.product)}
                          style={{ padding: "6px 12px", fontSize: "14px" }}
                        >
                          Reactivate
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  );
}




