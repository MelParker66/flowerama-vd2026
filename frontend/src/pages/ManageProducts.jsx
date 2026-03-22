import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAllProducts, deactivateProduct, reactivateProduct, saveAllProducts, uploadProducts, deleteProduct } from "../api/api";
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductPlanned, setNewProductPlanned] = useState("0");
  const [searchFilter, setSearchFilter] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState(null);
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState([]);
  const { refreshAll } = useData();

  const toggleDeleteSelection = (name) => {
    setSelectedForDelete(prev =>
      prev.includes(name)
        ? prev.filter(n => n !== name)
        : [...prev, name]
    );
  };

  const filteredProducts = searchFilter.trim()
    ? products.filter(p => p.product.toLowerCase().includes(searchFilter.trim().toLowerCase()))
    : products;

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
      setHasUnsavedChanges(false); // Reset unsaved changes when loading fresh data
    } catch (err) {
      console.error("Failed to load products:", err);
      setError(err.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pinVerified) {
      loadProducts();
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

  const handleBulkDelete = async () => {
    setMessage({ type: "", text: "" });
    const errors = [];
    let successCount = 0;
    for (const name of selectedForDelete) {
      try {
        await deleteProduct(name);
        successCount++;
      } catch (err) {
        errors.push(name);
      }
    }
    await loadProducts();
    await refreshAll();
    window.dispatchEvent(new Event("dataUpdated"));
    setBulkDeleteMode(false);
    setSelectedForDelete([]);
    if (errors.length === 0) {
      setMessage({ type: "success", text: `${successCount} product(s) deleted.` });
    } else {
      setMessage({ type: "error", text: `${successCount} deleted. Failed: ${errors.join(", ")}` });
    }
    setTimeout(() => setMessage({ type: "", text: "" }), 5000);
  };

  const handleDeleteProduct = async (productName) => {
    setMessage({ type: "", text: "" });
    try {
      await deleteProduct(productName);
      setMessage({ type: "success", text: `"${productName}" has been deleted.` });
      setDeleteConfirmProduct(null);
      await loadProducts();
      await refreshAll();
      window.dispatchEvent(new Event("dataUpdated"));
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to delete product." });
      setDeleteConfirmProduct(null);
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
    // Only select active products (from filtered view when search is active)
    const activeProducts = filteredProducts.filter(p => p.active).map(p => p.product);
    if (selectedProducts.size === activeProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(activeProducts));
    }
  };

  const handleToggleActive = (productName) => {
    const updatedProducts = products.map(p => 
      p.product === productName 
        ? { ...p, active: !p.active }
        : p
    );
    setProducts(updatedProducts);
    setHasUnsavedChanges(true);
  };

  const handleSaveChanges = async () => {
    setMessage({ type: "", text: "" });
    
    // Convert products array to object format for backend
    const productsObject = {};
    products.forEach(p => {
      productsObject[p.product] = {
        planned: p.planned ?? 0,
        active: p.active ?? true
      };
    });

    try {
      await saveAllProducts(productsObject);
      setMessage({ 
        type: "success", 
        text: `All product changes have been saved.` 
      });
      setHasUnsavedChanges(false);
      await loadProducts(); // Reload fresh data from backend
      await refreshAll();
      window.dispatchEvent(new Event("dataUpdated"));
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (err) {
      console.error("Save failed:", err);
      setMessage({ 
        type: "error", 
        text: err.message || "Failed to save changes. Please try again." 
      });
    }
  };

  const handleExportCsv = () => {
    const header = "Product,Planned,Active\n";
    const rows = products.map(p =>
      `"${(p.product || "").replace(/"/g, '""')}",${p.planned ?? 0},${p.active ? "Yes" : "No"}`
    ).join("\n");
    const csv = header + rows;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flowerama-products-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadProducts = useCallback(async () => {
    if (uploading) return;
    if (!uploadFile) {
      setMessage({ type: "error", text: "Please select an .xlsx file." });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
      return;
    }
    setMessage({ type: "", text: "" });
    setUploading(true);
    try {
      const result = await uploadProducts(uploadFile);
      setMessage({ type: "success", text: `Uploaded ${result.count} products.` });
      setUploadFile(null);
      setUploadInputKey((k) => k + 1);
      await loadProducts();
      await refreshAll();
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Upload failed." });
    } finally {
      setUploading(false);
    }
  }, [uploadFile, uploading]);

  const handleAddProduct = () => {
    const name = newProductName.trim();
    const planned = parseInt(newProductPlanned, 10);
    if (!name) {
      setMessage({ type: "error", text: "Product name is required." });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
      return;
    }
    const exists = products.some(p => p.product.toLowerCase() === name.toLowerCase());
    if (exists) {
      setMessage({ type: "error", text: `"${name}" already exists.` });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
      return;
    }
    if (isNaN(planned) || planned < 0) {
      setMessage({ type: "error", text: "Planned must be 0 or greater." });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
      return;
    }
    const newProduct = { product: name, planned: planned, active: true };
    const updated = [...products, newProduct].sort((a, b) =>
      a.product.localeCompare(b.product, undefined, { sensitivity: "base" })
    );
    setProducts(updated);
    setHasUnsavedChanges(true);
    setNewProductName("");
    setNewProductPlanned("0");
    setShowAddForm(false);
    setMessage({ type: "success", text: `"${name}" added. Click Save Changes to persist.` });
    setTimeout(() => setMessage({ type: "", text: "" }), 3000);
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
      <div className="card manage-products-card">
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
      <div className="card manage-products-card">
        <h2>Manage Products</h2>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card manage-products-card">
        <h2>Manage Products</h2>
        <div className="message error">{error}</div>
        <button className="btn primary" onClick={loadProducts}>Retry</button>
      </div>
    );
  }

  return (
    <div className="card manage-products-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ margin: 0 }}>Manage Products</h2>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {hasUnsavedChanges && (
            <button
              className="btn primary"
              onClick={handleSaveChanges}
              style={{ padding: "8px 16px", fontSize: "14px" }}
            >
              Save Changes
            </button>
          )}
          {!bulkMode && (
            <>
              <button
                className="btn"
                onClick={() => setShowAddForm(!showAddForm)}
                style={{ padding: "8px 16px", fontSize: "14px", background: "#059669", color: "#fff" }}
              >
                {showAddForm ? "Cancel Add" : "Add Product"}
              </button>
              <button
                className="btn"
                onClick={handleExportCsv}
                style={{ padding: "8px 16px", fontSize: "14px", background: "#4b5563", color: "#fff" }}
              >
                Export CSV
              </button>
            </>
          )}
          {!bulkMode && !bulkDeleteMode && (
            <button
              className="btn danger"
              onClick={() => {
                setBulkMode(false);
                setSelectedProducts(new Set());
                setBulkDeleteMode(true);
              }}
              style={{ padding: "8px 16px", fontSize: "14px" }}
            >
              Bulk Delete
            </button>
          )}
          {!bulkMode && !bulkDeleteMode ? (
            <button
              className="btn danger"
              onClick={() => {
                setBulkDeleteMode(false);
                setSelectedForDelete([]);
                setBulkMode(true);
              }}
              style={{ padding: "8px 16px", fontSize: "14px" }}
            >
              Bulk Deactivate
            </button>
          ) : bulkDeleteMode ? (
            <>
              <button
                className="btn danger"
                onClick={handleBulkDelete}
                style={{ padding: "8px 16px", fontSize: "14px" }}
                disabled={selectedForDelete.length === 0}
              >
                Delete Selected ({selectedForDelete.length})
              </button>
              <button
                className="btn"
                onClick={() => {
                  setBulkDeleteMode(false);
                  setSelectedForDelete([]);
                }}
                style={{ padding: "8px 16px", fontSize: "14px", background: "#6b7280", color: "#fff", marginLeft: "10px" }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
      
      {message.text && (
        <div className={`message ${message.type === "success" ? "success" : "error"}`}>
          {message.text}
        </div>
      )}

      {showAddForm && (
        <div style={{ marginBottom: "20px", padding: "16px", border: "1px solid #e5e7eb", borderRadius: "8px", backgroundColor: "#f9fafb" }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "16px" }}>Add New Product</h3>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="field" style={{ flex: "1 1 200px", margin: 0 }}>
              <label className="label" style={{ marginBottom: "4px" }}>Product name</label>
              <input
                type="text"
                className="input"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                placeholder="e.g. Summer Bloom - SM"
                style={{ width: "100%" }}
              />
            </div>
            <div className="field" style={{ flex: "0 0 100px", margin: 0 }}>
              <label className="label" style={{ marginBottom: "4px" }}>Planned</label>
              <input
                type="number"
                className="input"
                min="0"
                value={newProductPlanned}
                onChange={(e) => setNewProductPlanned(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            <button
              className="btn primary"
              onClick={handleAddProduct}
              style={{ padding: "8px 16px", fontSize: "14px" }}
            >
              Add
            </button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: "20px", padding: "16px", border: "1px solid #e5e7eb", borderRadius: "8px", backgroundColor: "#f9fafb" }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "16px" }}>Upload Warehouse List</h3>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <input
            key={uploadInputKey}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            style={{ fontSize: "14px" }}
          />
          <button
            className="btn primary"
            onClick={handleUploadProducts}
            disabled={!uploadFile || uploading}
            style={{ padding: "8px 16px", fontSize: "14px" }}
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
          {uploadFile && (
            <span style={{ color: "#6b7280", fontSize: "14px" }}>{uploadFile.name}</span>
          )}
        </div>
        <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#6b7280" }}>
          Upload an .xlsx file to replace the product list. First sheet: Product name and Planned quantity columns.
        </p>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <input
          type="text"
          className="input"
          placeholder="Search products..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          style={{ maxWidth: "280px" }}
        />
        {searchFilter.trim() && (
          <span style={{ marginLeft: "8px", color: "#6b7280", fontSize: "14px" }}>
            {filteredProducts.length} of {products.length}
          </span>
        )}
      </div>
      
      {products.length === 0 ? (
        <p>No products found.</p>
      ) : filteredProducts.length === 0 ? (
        <p>No products match &quot;{searchFilter.trim()}&quot;.</p>
      ) : (
        <div className="table-scroll">
          <div className="tableWrap">
            <table className="table">
            <thead>
              <tr>
                {bulkDeleteMode && (
                  <th style={{ width: "40px" }} />
                )}
                {bulkMode && (
                  <th style={{ width: "40px" }}>
                    <input
                      type="checkbox"
                      checked={filteredProducts.filter(p => p.active).length > 0 && 
                               selectedProducts.size === filteredProducts.filter(p => p.active).length}
                      onChange={handleSelectAll}
                      style={{ cursor: "pointer" }}
                    />
                  </th>
                )}
                <th>Product</th>
                <th className="col-num col-planned">Planned</th>
                <th>Active</th>
                {!bulkMode && !bulkDeleteMode && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.product}>
                  {bulkDeleteMode && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedForDelete.includes(product.product)}
                        onChange={() => toggleDeleteSelection(product.product)}
                      />
                    </td>
                  )}
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
                  <td>
                    <input
                      type="checkbox"
                      checked={product.active ?? false}
                      onChange={() => handleToggleActive(product.product)}
                      style={{ cursor: "pointer", width: "18px", height: "18px" }}
                    />
                  </td>
                  {!bulkMode && !bulkDeleteMode && (
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
                      <button
                        className="btn danger"
                        onClick={() => setDeleteConfirmProduct(product.product)}
                        style={{ padding: "6px 12px", fontSize: "14px", marginLeft: "8px" }}
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {bulkDeleteMode && (
          <div className="bulk-actions" style={{ marginTop: "20px" }}>
            <button className="btn danger" onClick={handleBulkDelete} disabled={selectedForDelete.length === 0}>
              Delete Selected
            </button>
            <button
              className="btn"
              style={{ marginLeft: "10px", background: "#6b7280", color: "#fff" }}
              onClick={() => {
                setBulkDeleteMode(false);
                setSelectedForDelete([]);
              }}
            >
              Cancel
            </button>
          </div>
        )}
        </div>
      )}

      {deleteConfirmProduct && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
          onClick={() => setDeleteConfirmProduct(null)}
        >
          <div
            style={{
              background: "#fff",
              padding: "24px",
              borderRadius: "8px",
              maxWidth: "400px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ margin: "0 0 20px 0", fontSize: "16px" }}>
              Are you sure you want to permanently delete this product?
            </p>
            <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "#6b7280" }}>
              &quot;{deleteConfirmProduct}&quot;
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                className="btn"
                onClick={() => setDeleteConfirmProduct(null)}
                style={{ padding: "8px 16px", background: "#6b7280", color: "#fff" }}
              >
                Cancel
              </button>
              <button
                className="btn danger"
                onClick={() => handleDeleteProduct(deleteConfirmProduct)}
                style={{ padding: "8px 16px" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




