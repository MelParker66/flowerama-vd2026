import { useState, useEffect } from "react";
import { saveWarehouseEntry, savePlannedEntry, fetchPlannedProducts } from "../api/api";
import { useData } from "../context/DataContext";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function Warehouse() {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [availableProducts, setAvailableProducts] = useState([]);
  const { refreshAll } = useData();
  
  // Planned form state
  const [plannedProduct, setPlannedProduct] = useState("");
  const [plannedQuantity, setPlannedQuantity] = useState("");
  const [plannedMessage, setPlannedMessage] = useState({ type: "", text: "" });
  
  // Load available products for dropdown
  useEffect(() => {
    fetchPlannedProducts()
      .then(products => setAvailableProducts(products))
      .catch(err => console.warn("Failed to fetch products:", err));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || !Number.isInteger(qty)) {
      setMessage({ type: "error", text: "Please enter a valid integer quantity (negative values allowed for corrections)" });
      return;
    }

    try {
      await saveWarehouseEntry(selectedDate, selectedProduct, qty);
      
      // Success - show message and reset quantity
      setMessage({ 
        type: "success", 
        text: `Entry saved successfully!` 
      });
      setQuantity("");
      
      // refreshAll() triggers dashboard refresh after warehouse entry
      await refreshAll();
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error("Save failed:", error);
      setMessage({ 
        type: "error", 
        text: error.message || "Failed to save entry. Please try again." 
      });
    }
  }
  
  async function handlePlannedSubmit(e) {
    e.preventDefault();
    setPlannedMessage({ type: "", text: "" });

    const planned = Number(plannedQuantity);
    if (!plannedProduct.trim()) {
      setPlannedMessage({ type: "error", text: "Please enter a product name" });
      return;
    }
    if (isNaN(planned)) {
      setPlannedMessage({ type: "error", text: "Please enter a valid planned quantity" });
      return;
    }

    try {
      await savePlannedEntry(plannedProduct.trim(), planned);
      
      // Success - refresh dashboard and show message
      setPlannedMessage({ 
        type: "success", 
        text: `Planned quantity saved successfully!` 
      });
      setPlannedProduct("");
      setPlannedQuantity("");
      
      // Refresh available products list
      const products = await fetchPlannedProducts();
      setAvailableProducts(products);
      
      // refreshAll() triggers dashboard refresh after planned update
      await refreshAll();
      
      // Dispatch global refresh event
      window.dispatchEvent(new Event("dataUpdated"));
      
      // Clear success message after 3 seconds
      setTimeout(() => setPlannedMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error("Save planned failed:", error);
      setPlannedMessage({ 
        type: "error", 
        text: error.message || "Failed to save planned quantity. Please try again." 
      });
    }
  }

  return (
    <div className="card">
      <h2>Warehouse</h2>
      
      {message.text && (
        <div className={`message ${message.type === "success" ? "success" : "error"}`}>
          {message.text}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label className="label">Date</label>
          <input
            className="input"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label className="label">Product</label>
          <select
            className="input"
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            required
          >
            <option value="">Select a product...</option>
            {availableProducts.map((product) => (
              <option key={product} value={product}>
                {product}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label">Quantity</label>
          <input
            className="input"
            type="number"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Enter quantity (negative values allowed for corrections)"
            required
          />
        </div>

        <button className="btn primary" type="submit">
          Save
        </button>
      </form>
      
      <div style={{ marginTop: "30px", paddingTop: "30px", borderTop: "1px solid #e5e7eb" }}>
        <h3 style={{ marginBottom: "18px", fontSize: "20px", fontWeight: 700 }}>Add / Update Planned</h3>
        
        {plannedMessage.text && (
          <div className={`message ${plannedMessage.type === "success" ? "success" : "error"}`}>
            {plannedMessage.text}
          </div>
        )}
        
        <form onSubmit={handlePlannedSubmit}>
          <div className="field">
            <label className="label">Product Name</label>
            <input
              className="input"
              type="text"
              list="productList"
              value={plannedProduct}
              onChange={(e) => setPlannedProduct(e.target.value)}
              placeholder="Select existing or type new product name"
              required
            />
            <datalist id="productList">
              {availableProducts.map((product) => (
                <option key={product} value={product} />
              ))}
            </datalist>
          </div>

          <div className="field">
            <label className="label">Planned Quantity</label>
            <input
              className="input"
              type="number"
              value={plannedQuantity}
              onChange={(e) => setPlannedQuantity(e.target.value)}
              placeholder="Enter planned quantity"
              required
            />
          </div>

          <button className="btn primary" type="submit">
            Save Planned
          </button>
        </form>
      </div>
    </div>
  );
}
