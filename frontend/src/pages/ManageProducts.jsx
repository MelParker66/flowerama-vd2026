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
      <h2>Manage Products</h2>
      
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
                <th>Product</th>
                <th className="col-num col-planned">Planned</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.product}>
                  <td className="col-product">{product.product}</td>
                  <td className="col-num col-planned">{product.planned ?? 0}</td>
                  <td>{product.active ? "Yes" : "No"}</td>
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




