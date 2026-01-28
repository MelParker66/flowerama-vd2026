import express from "express";
import cors from "cors";
import { store } from "./store.js";
import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Override storage file path
const OVERRIDES_FILE = path.join(__dirname, "planned-overrides.json");

const app = express()
const allowedOrigins = [
  'http://localhost:5173',
  'https://flowerama226.netlify.app'
];app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

const PORT = process.env.PORT || 3001;

// Load planned quantities from Excel file on server start
let plannedByProduct = {}; // Excel-based planned quantities
let overridesPlannedByProduct = {}; // User overrides stored in JSON
let loadError = null;
let resolvedPathUsed = null;
let sheetNameUsed = null;
let first5RowsPreview = null;
let detectedProductCol = null;
let detectedPlannedCol = null;

// Load overrides from disk
function loadOverrides() {
  try {
    if (fs.existsSync(OVERRIDES_FILE)) {
      const data = fs.readFileSync(OVERRIDES_FILE, "utf8");
      const raw = JSON.parse(data);
      // Migrate old format (just numbers) to new format (objects with planned and active)
      overridesPlannedByProduct = {};
      Object.keys(raw).forEach(product => {
        if (typeof raw[product] === 'number') {
          // Old format: just a number
          overridesPlannedByProduct[product] = { planned: raw[product], active: true };
        } else {
          // New format: object with planned and active
          overridesPlannedByProduct[product] = {
            planned: raw[product].planned ?? 0,
            active: raw[product].active !== undefined ? raw[product].active : true
          };
        }
      });
      console.log(`[loadOverrides] Loaded ${Object.keys(overridesPlannedByProduct).length} planned overrides`);
    } else {
      overridesPlannedByProduct = {};
      console.log(`[loadOverrides] No overrides file found, starting with empty overrides`);
    }
  } catch (error) {
    console.error("[loadOverrides] Error loading overrides:", error);
    overridesPlannedByProduct = {};
  }
}

// Save overrides to disk
function saveOverrides() {
  try {
    fs.writeFileSync(OVERRIDES_FILE, JSON.stringify(overridesPlannedByProduct, null, 2), "utf8");
    console.log(`[saveOverrides] Saved ${Object.keys(overridesPlannedByProduct).length} planned overrides`);
  } catch (error) {
    console.error("[saveOverrides] Error saving overrides:", error);
    throw error;
  }
}

// Get merged planned quantities (Excel + overrides, overrides win)
// Returns only active products
function getMergedPlanned(includeInactive = false) {
  const merged = { ...plannedByProduct };
  // Overrides take precedence
  Object.keys(overridesPlannedByProduct).forEach(product => {
    const override = overridesPlannedByProduct[product];
    if (includeInactive || override.active !== false) {
      merged[product] = typeof override === 'object' ? override.planned : override;
    }
  });
  // Filter out inactive products from Excel data if we have override info
  if (!includeInactive) {
    Object.keys(merged).forEach(product => {
      if (overridesPlannedByProduct[product] && overridesPlannedByProduct[product].active === false) {
        delete merged[product];
      }
    });
  }
  return merged;
}

// Get all products with their active status
function getAllProducts() {
  const products = {};
  // Start with Excel products (all active by default)
  Object.keys(plannedByProduct).forEach(product => {
    products[product] = {
      planned: plannedByProduct[product],
      active: true
    };
  });
  // Apply overrides (which may include active flag)
  Object.keys(overridesPlannedByProduct).forEach(product => {
    const override = overridesPlannedByProduct[product];
    if (typeof override === 'object') {
      products[product] = {
        planned: override.planned,
        active: override.active !== undefined ? override.active : true
      };
    } else {
      // Legacy format
      products[product] = {
        planned: override,
        active: true
      };
    }
  });
  return products;
}

function loadPlannedQuantities() {
  loadError = null;
  try {
    const excelPath = process.env.PLANNED_XLSX || path.join(__dirname, "..", "VD2026.xlsx");
    resolvedPathUsed = excelPath;
    
    console.log(`[loadPlannedQuantities] Resolved file path: ${resolvedPathUsed}`);
    
    if (!fs.existsSync(excelPath)) {
      const errMsg = `Excel file not found at ${excelPath}`;
      console.warn(`[loadPlannedQuantities] ${errMsg}`);
      loadError = errMsg;
      return;
    }
    
    const workbook = XLSX.readFile(excelPath);
    sheetNameUsed = workbook.SheetNames[0];
    console.log(`[loadPlannedQuantities] Using first sheet: ${sheetNameUsed}`);
    const worksheet = workbook.Sheets[sheetNameUsed];
    
    // Parse without headers as arrays
    const rowsAsArrays = XLSX.utils.sheet_to_json(worksheet, { header: false, defval: "" });
    
    console.log(`[loadPlannedQuantities] Parsed ${rowsAsArrays.length} rows as arrays`);
    
    plannedByProduct = {};
    
    // Determine which column is Product vs Planned by scanning first ~30 non-empty rows
    let col0StringCount = 0;
    let col0NumberCount = 0;
    let col1StringCount = 0;
    let col1NumberCount = 0;
    let rowsScanned = 0;
    
    for (let i = 0; i < Math.min(30, rowsAsArrays.length); i++) {
      const row = rowsAsArrays[i];
      const values = Array.isArray(row) ? row : Object.values(row);
      
      if (values.length < 2) continue;
      
      const val0 = values[0];
      const val1 = values[1];
      
      // Check column 0
      const str0 = String(val0 || "").trim();
      const num0 = Number(val0);
      if (str0 && !isNaN(num0) && str0 === String(num0)) {
        col0NumberCount++;
      } else if (str0) {
        col0StringCount++;
      }
      
      // Check column 1
      const str1 = String(val1 || "").trim();
      const num1 = Number(val1);
      if (str1 && !isNaN(num1) && str1 === String(num1)) {
        col1NumberCount++;
      } else if (str1) {
        col1StringCount++;
      }
      
      rowsScanned++;
    }
    
    // Product column = the column with mostly string values (non-empty, not just numbers)
    // Planned column = the column with mostly numeric values
    if (col1StringCount > col0StringCount && col0NumberCount > col1NumberCount) {
      detectedProductCol = 1;
      detectedPlannedCol = 0;
    } else if (col0StringCount > col1StringCount && col1NumberCount > col0NumberCount) {
      detectedProductCol = 0;
      detectedPlannedCol = 1;
    } else {
      // If ambiguous, default to: productCol = 1, plannedCol = 0
      detectedProductCol = 1;
      detectedPlannedCol = 0;
    }
    
    console.log(`[loadPlannedQuantities] Detected: productCol=${detectedProductCol}, plannedCol=${detectedPlannedCol} (scanned ${rowsScanned} rows, col0: ${col0StringCount}s/${col0NumberCount}n, col1: ${col1StringCount}s/${col1NumberCount}n)`);
    
    // Store first 5 rows for debug preview using detected mapping
    first5RowsPreview = rowsAsArrays.slice(0, 5).map(row => {
      const values = Array.isArray(row) ? row : Object.values(row);
      return {
        product: String(values[detectedProductCol] || "").trim(),
        planned: values[detectedPlannedCol]
      };
    });
    
    // Process ALL rows starting at index 0 (first row is data, not header)
    rowsAsArrays.forEach((row) => {
      // Get values as array
      const values = Array.isArray(row) ? row : Object.values(row);
      
      // Use detected column mapping
      const product = String(values[detectedProductCol] || "").trim();
      const planned = Number(values[detectedPlannedCol]);
      
      // Only include row if product is non-empty AND planned is a valid number
      if (product && !isNaN(planned)) {
        if (!plannedByProduct[product]) {
          plannedByProduct[product] = 0;
        }
        plannedByProduct[product] += planned;
      }
    });
    
    console.log(`FINAL plannedByProduct:`, plannedByProduct);
  } catch (error) {
    loadError = error.stack || error.message || String(error);
    console.error("[loadPlannedQuantities] Error loading planned quantities:");
    console.error(error.stack || error);
  }
}

// Load planned quantities on startup
loadPlannedQuantities();
loadOverrides();

// CORS configuration - allow frontend at localhost:5173 and Netlify
const allowedOrigins = [
  'http://localhost:5173',
  'https://flowerama226.netlify.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

// Parse JSON request bodies
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({ ok: true, message: "backend live" });
});

// Warehouse POST - writes to store.produced
// Negative quantities are allowed for corrections
app.post("/warehouse", (req, res) => {
  const { date, product, quantity } = req.body;
  const qty = quantity !== undefined ? quantity : (req.body.qty !== undefined ? req.body.qty : null);
  
  if (!date || !product || qty === null || !Number.isInteger(Number(qty))) {
    return res.status(400).json({ success: false, error: "date, product, and quantity (integer) are required" });
  }
  
  store.produced.push({ date, product, qty: Number(qty) });
  store.lastModified[product] = date;
  
  res.json({
    success: true
  });
});

// Negative quantities are allowed for corrections
app.post("/api/warehouse", (req, res) => {
  const { date, product, quantity, qty } = req.body;
  const quantityValue = qty !== undefined ? qty : (quantity !== undefined ? quantity : null);
  
  if (!date || !product || quantityValue === null || !Number.isInteger(Number(quantityValue))) {
    return res.status(400).json({ success: false, error: "date, product, and quantity (integer) are required" });
  }
  
  store.produced.push({ date, product, qty: Number(quantityValue) });
  store.lastModified[product] = date;
  
  res.json({
    success: true
  });
});

// Produced POST endpoint
// Negative quantities are allowed for corrections
app.post("/api/produced", (req, res) => {
  const { date, product, qty } = req.body;
  
  if (!date || !product || qty === undefined || !Number.isInteger(Number(qty))) {
    return res.status(400).json({ success: false, error: "date, product, and qty (integer) are required" });
  }
  
  store.produced.push({ date, product, qty: Number(qty) });
  store.lastModified[product] = date;
  
  res.json({
    success: true
  });
});

// Sent-to-Shop POST - writes to store.sentToShop
// Negative quantities are allowed for corrections
app.post("/api/sent-to-shop", (req, res) => {
  const { date, product, quantity, qty } = req.body;
  const quantityValue = qty !== undefined ? qty : (quantity !== undefined ? quantity : null);
  
  if (!date || !product || quantityValue === null || !Number.isInteger(Number(quantityValue))) {
    return res.status(400).json({ ok: false, error: "date, product, and quantity (integer) are required" });
  }
  
  store.sentToShop.push({ date, product, qty: Number(quantityValue) });
  store.lastModified[product] = date;
  
  res.json({
    ok: true
  });
});

// Shop POST - writes to store.sold
// Negative quantities are allowed for corrections
app.post("/api/shop", (req, res) => {
  const { date, product, quantity, qty } = req.body;
  const quantityValue = qty !== undefined ? qty : (quantity !== undefined ? quantity : null);
  
  if (!date || !product || quantityValue === null || !Number.isInteger(Number(quantityValue))) {
    return res.status(400).json({ success: false, error: "date, product, and quantity (integer) are required" });
  }
  
  store.sold.push({ date, product, qty: Number(quantityValue) });
  store.lastModified[product] = date;
  
  res.json({
    success: true
  });
});

// Sold POST endpoint (alias for /api/shop)
// Negative quantities are allowed for corrections
app.post("/api/sold", (req, res) => {
  const { date, product, qty } = req.body;
  
  if (!date || !product || qty === undefined || !Number.isInteger(Number(qty))) {
    return res.status(400).json({ ok: false, error: "date, product, and qty (integer) are required" });
  }
  
  store.sold.push({ date, product, qty: Number(qty) });
  store.lastModified[product] = date;
  
  res.json({
    ok: true
  });
});

// Planned GET - returns merged planned quantities (Excel + overrides)
app.get("/api/planned", (req, res) => {
  const merged = getMergedPlanned();
  res.json({
    ok: true,
    plannedByProduct: merged,
    count: Object.keys(merged).length
  });
});

// Planned Debug GET - returns debug information
app.get("/api/planned/debug", (req, res) => {
  const fileExists = resolvedPathUsed ? fs.existsSync(resolvedPathUsed) : false;
  const merged = getMergedPlanned();
  const sampleKeys = Object.keys(merged).slice(0, 5);
  
  res.json({
    ok: true,
    plannedPathUsed: resolvedPathUsed || null,
    fileExists: fileExists,
    sheetName: sheetNameUsed || null,
    detectedProductCol: detectedProductCol,
    detectedPlannedCol: detectedPlannedCol,
    first5RowsPreview: first5RowsPreview || null,
    count: Object.keys(merged).length,
    sampleKeys: sampleKeys
  });
});

// Planned POST - add/update planned quantity override
app.post("/api/planned", (req, res) => {
  const { product, planned } = req.body;
  
  // Validate
  if (!product || typeof product !== "string" || !product.trim()) {
    return res.status(400).json({ ok: false, error: "Product name is required" });
  }
  
  const plannedNum = Number(planned);
  if (isNaN(plannedNum)) {
    return res.status(400).json({ ok: false, error: "Planned quantity must be a valid number" });
  }
  
  // Update override (preserve active status if exists)
  const productTrimmed = product.trim();
  const existing = overridesPlannedByProduct[productTrimmed];
  const isNewProduct = !existing && !plannedByProduct[productTrimmed];
  
  overridesPlannedByProduct[productTrimmed] = {
    planned: plannedNum,
    active: existing && typeof existing === 'object' ? existing.active : true
  };
  
  // Note: Manage Products actions do not write history (only Warehouse, Sent to Shop, and Shop do)
  
  // Save to disk
  try {
    saveOverrides();
  } catch (error) {
    return res.status(500).json({ ok: false, error: "Failed to save override" });
  }
  
  // Return merged result
  const merged = getMergedPlanned();
  res.json({
    ok: true,
    plannedByProduct: merged,
    count: Object.keys(merged).length
  });
});

// Planned DELETE - remove planned quantity override
app.delete("/api/planned/:product", (req, res) => {
  const product = decodeURIComponent(req.params.product);
  
  if (overridesPlannedByProduct[product]) {
    delete overridesPlannedByProduct[product];
    
    // Save to disk
    try {
      saveOverrides();
    } catch (error) {
      return res.status(500).json({ ok: false, error: "Failed to save override" });
    }
  }
  
  // Return merged result
  const merged = getMergedPlanned();
  res.json({
    ok: true,
    plannedByProduct: merged,
    count: Object.keys(merged).length
  });
});

// Products GET - return all products with active status
app.get("/api/products", (req, res) => {
  const products = getAllProducts();
  const productList = Object.keys(products).map(product => ({
    product,
    planned: products[product].planned,
    active: products[product].active
  }));
  res.json({
    ok: true,
    products: productList
  });
});

// Products POST - deactivate a product
app.post("/api/products/deactivate", (req, res) => {
  const { productName } = req.body;
  
  if (!productName || typeof productName !== "string" || !productName.trim()) {
    return res.status(400).json({ ok: false, error: "Product name is required" });
  }
  
  const productTrimmed = productName.trim();
  const existing = overridesPlannedByProduct[productTrimmed];
  const planned = existing && typeof existing === 'object' ? existing.planned : (existing || plannedByProduct[productTrimmed] || 0);
  
  overridesPlannedByProduct[productTrimmed] = {
    planned: planned,
    active: false
  };
  
  // Note: Manage Products actions do not write history (only Warehouse, Sent to Shop, and Shop do)
  
  try {
    saveOverrides();
  } catch (error) {
    return res.status(500).json({ ok: false, error: "Failed to save product status" });
  }
  
  res.json({ ok: true });
});

// Products POST - reactivate a product
app.post("/api/products/reactivate", (req, res) => {
  const { productName } = req.body;
  
  if (!productName || typeof productName !== "string" || !productName.trim()) {
    return res.status(400).json({ ok: false, error: "Product name is required" });
  }
  
  const productTrimmed = productName.trim();
  const existing = overridesPlannedByProduct[productTrimmed];
  const planned = existing && typeof existing === 'object' ? existing.planned : (existing || plannedByProduct[productTrimmed] || 0);
  
  overridesPlannedByProduct[productTrimmed] = {
    planned: planned,
    active: true
  };
  
  // Note: Manage Products actions do not write history (only Warehouse, Sent to Shop, and Shop do)
  
  try {
    saveOverrides();
  } catch (error) {
    return res.status(500).json({ ok: false, error: "Failed to save product status" });
  }
  
  res.json({ ok: true });
});

// Helper function to add history events (APPEND-ONLY - never clears existing history)
// WHITELIST: Only Warehouse, Sent to Shop, and Shop can write history
// Manage Products actions are NOT tracked in history
function addHistoryEvent({ type, action, product, date, ts, notes, area, qty }) {
  // Hard filter: Manage Products can NEVER appear in history
  const entry = { area, type };
  if (!entry || entry.area === "Manage Products" || entry.type === "manageProducts") return;
  
  // Ensure history array exists (only initialize if undefined/null, never reset if it already exists)
  if (!store.history || !Array.isArray(store.history)) {
    store.history = [];
  }
  // APPEND the new event - never overwrite or clear existing entries
  // Read existing history, push new event, store.history is already the combined array
  const newEvent = {
    ts: ts || new Date().toISOString(),
    date: date || new Date().toISOString().split('T')[0],
    type: type || "",
    action: action,
    product: product,
    notes: notes || ""
  };
  // Add optional fields if provided
  if (area) newEvent.area = area;
  if (qty !== undefined) newEvent.qty = qty;
  
  store.history.push(newEvent);
}

// Helper function to calculate totals by product from entries
function calculateTotalsByProduct(entries) {
  const totals = {};
  entries.forEach(entry => {
    if (!totals[entry.product]) {
      totals[entry.product] = 0;
    }
    totals[entry.product] += entry.qty || 0;
  });
  return totals;
}

// GET endpoints for individual entry types
app.get("/api/produced", (req, res) => {
  res.json({
    ok: true,
    entries: store.produced
  });
});

app.get("/api/sent-to-shop", (req, res) => {
  res.json({
    ok: true,
    entries: store.sentToShop
  });
});

app.get("/api/sold", (req, res) => {
  res.json({
    ok: true,
    entries: store.sold
  });
});

// History GET - returns combined list sorted newest-first by ts, then date
// WHITELIST: Only Warehouse, Sent to Shop, and Shop entries
// Filter out any Manage Products entries before returning
app.get("/api/history", (req, res) => {
  // Combine all history sources
  const history = [
    ...store.produced.map(e => ({ ...e, type: "Produced", area: "Warehouse" })),
    ...store.sentToShop.map(e => ({ ...e, type: "Sent", area: "Sent to Shop" })),
    ...store.sold.map(e => ({ ...e, type: "Shop", area: "Shop" })),
    ...(store.history || []).map(e => ({ ...e }))
  ];
  
  // Hard filter: only allow Warehouse, Sent to Shop, Shop
  const allowed = new Set(["Warehouse", "Sent to Shop", "Shop"]);
  const filtered = history.filter(h => allowed.has(h.area));
  
  // Sort by ts descending (newest first), fall back to date if ts missing
  filtered.sort((a, b) => {
    if (a.ts && b.ts) {
      return b.ts.localeCompare(a.ts);
    }
    if (a.ts) return -1;
    if (b.ts) return 1;
    // Fall back to date comparison
    const dateCompare = (b.date || "").localeCompare(a.date || "");
    if (dateCompare !== 0) return dateCompare;
    return (a.product || "").localeCompare(b.product || "");
  });
  
  res.json({ ok: true, history: filtered });
});

// Dashboard GET - computes from store (only active products)
app.get("/api/dashboard", (req, res) => {
  const byProduct = {};
  
  // Get today's date in YYYY-MM-DD format
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  // Get merged planned (Excel + overrides) - only active products
  const mergedPlanned = getMergedPlanned(false);
  
  // Get all products to check active status - START FROM ALL ACTIVE PRODUCTS
  const allProductsData = getAllProducts();
  
  // Calculate totals from entries
  const producedTotals = calculateTotalsByProduct(store.produced);
  const sentToShopTotals = calculateTotalsByProduct(store.sentToShop);
  const soldTotals = calculateTotalsByProduct(store.sold);
  
  // FIX: Start from ALL active products (not just those with activity)
  // This ensures new products appear immediately, even with zero activity
  const allActiveProducts = Object.keys(allProductsData).filter(product => {
    const productData = allProductsData[product];
    return !productData || productData.active !== false;
  });
  
  // Also include any products from activity that might not be in allProductsData yet
  const activityProducts = new Set([
    ...Object.keys(producedTotals),
    ...Object.keys(sentToShopTotals),
    ...Object.keys(soldTotals)
  ]);
  
  // Union: all active products + any products from activity (filtered to active)
  const allProducts = new Set([
    ...allActiveProducts,
    ...Array.from(activityProducts).filter(product => {
      const productData = allProductsData[product];
      return !productData || productData.active !== false;
    })
  ]);
  
  const activeProducts = Array.from(allProducts);
  
  activeProducts.forEach((product) => {
    // For each product:
    const planned = mergedPlanned[product] || 0;
    const produced = producedTotals[product] || 0;
    const sentToShop = sentToShopTotals[product] || 0;
    const sold = soldTotals[product] || 0;
    
    // Calculate:
    const net = produced - sentToShop - sold;
    const aheadBehind = produced - planned;
    
    // dateModified should be the most recent date for that product from saved entries if available; otherwise today's date
    const dateModified = store.lastModified[product] || todayStr;
    
    // Status rules based on net:
    let status = "";
    let statusColor = "";
    if (net === 0) {
      status = "Doing great";
      statusColor = "yellow";
    } else if (net < 0) {
      status = "Just a little more";
      statusColor = "red";
    } else {
      status = "Yippee";
      statusColor = "green";
    }
    
    byProduct[product] = {
      product,
      dateModified,
      planned,
      produced,
      sentToShop,
      sold,
      net,
      aheadBehind,
      status,
      statusColor
    };
  });
  
  // Calculate totals:
  const totals = {
    planned: Object.values(byProduct).reduce((sum, p) => sum + p.planned, 0),
    produced: Object.values(byProduct).reduce((sum, p) => sum + p.produced, 0),
    sentToShop: Object.values(byProduct).reduce((sum, p) => sum + p.sentToShop, 0),
    sold: Object.values(byProduct).reduce((sum, p) => sum + p.sold, 0),
    net: Object.values(byProduct).reduce((sum, p) => sum + p.net, 0)
  };
  
  res.json({
    ok: true,
    totals,
    byProduct
  });
});

// Summary GET - same as dashboard (for frontend compatibility) - only active products
app.get("/api/summary", (req, res) => {
  // Redirect to dashboard endpoint for consistency
  const byProduct = {};
  
  // Get today's date in YYYY-MM-DD format
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  // Get merged planned (Excel + overrides) - only active products
  const mergedPlanned = getMergedPlanned(false);
  
  // Get all products to check active status - START FROM ALL ACTIVE PRODUCTS
  const allProductsData = getAllProducts();
  
  // Calculate totals from entries
  const producedTotals = calculateTotalsByProduct(store.produced);
  const sentToShopTotals = calculateTotalsByProduct(store.sentToShop);
  const soldTotals = calculateTotalsByProduct(store.sold);
  
  // FIX: Start from ALL active products (not just those with activity)
  // This ensures new products appear immediately, even with zero activity
  const allActiveProducts = Object.keys(allProductsData).filter(product => {
    const productData = allProductsData[product];
    return !productData || productData.active !== false;
  });
  
  // Also include any products from activity that might not be in allProductsData yet
  const activityProducts = new Set([
    ...Object.keys(producedTotals),
    ...Object.keys(sentToShopTotals),
    ...Object.keys(soldTotals)
  ]);
  
  // Union: all active products + any products from activity (filtered to active)
  const allProducts = new Set([
    ...allActiveProducts,
    ...Array.from(activityProducts).filter(product => {
      const productData = allProductsData[product];
      return !productData || productData.active !== false;
    })
  ]);
  
  const activeProducts = Array.from(allProducts);
  
  activeProducts.forEach((product) => {
    const planned = mergedPlanned[product] || 0;
    const produced = producedTotals[product] || 0;
    const sentToShop = sentToShopTotals[product] || 0;
    const sold = soldTotals[product] || 0;
    const net = produced - sentToShop - sold;
    const aheadBehind = produced - planned;
    const dateModified = store.lastModified[product] || todayStr;
    
    // Status rules based on net:
    let status = "";
    let statusColor = "";
    if (net === 0) {
      status = "Doing great";
      statusColor = "yellow";
    } else if (net < 0) {
      status = "Just a little more";
      statusColor = "red";
    } else {
      status = "Yippee";
      statusColor = "green";
    }
    
    byProduct[product] = {
      product,
      dateModified,
      planned,
      produced,
      sentToShop,
      sold,
      net,
      aheadBehind,
      status,
      statusColor
    };
  });
  
  // Calculate totals
  const totals = {
    planned: Object.values(byProduct).reduce((sum, p) => sum + p.planned, 0),
    produced: Object.values(byProduct).reduce((sum, p) => sum + p.produced, 0),
    sentToShop: Object.values(byProduct).reduce((sum, p) => sum + p.sentToShop, 0),
    sold: Object.values(byProduct).reduce((sum, p) => sum + p.sold, 0),
    net: Object.values(byProduct).reduce((sum, p) => sum + p.net, 0)
  };
  
  res.json({
    ok: true,
    totals,
    byProduct
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
