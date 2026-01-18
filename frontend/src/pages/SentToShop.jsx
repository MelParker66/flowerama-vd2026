import { useState, useEffect } from "react";
import { saveSentToShopEntry, fetchPlannedProducts } from "../api/api";
import { useData } from "../context/DataContext";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function SentToShop() {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [availableProducts, setAvailableProducts] = useState([]);
  const { refreshSummary } = useData();
  
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
      await saveSentToShopEntry(selectedDate, selectedProduct, qty);
      
      // Success - show message and reset quantity
      setMessage({ 
        type: "success", 
        text: `Entry saved successfully!` 
      });
      setQuantity("");
      
      // Trigger Dashboard refresh immediately
      await refreshSummary();
      
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

  return (
    <div className="card">
      <h2>Sent to Shop</h2>
      
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
    </div>
  );
}
