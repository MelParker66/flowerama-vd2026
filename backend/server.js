import express from "express";
import cors from "cors";
import multer from "multer";
import { store } from "./store.js";
import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Override storage file path
const OVERRIDES_FILE = path.join(__dirname, "planned-overrides.json");
const PRODUCTS_FILE = path.join(__dirname, "data", "products.json");
const app = express();
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

// Load products from file
function loadProducts() {
  try {
    if (fs.existsSync(PRODUCTS_FILE)) {
      const data = fs.readFileSync(PRODUCTS_FILE, "utf8");
      return JSON.parse(data);
    } else {
      console.log(`[loadProducts] Products file not found, starting with empty products`);
      return {};
    }
  } catch (error) {
    console.error("[loadProducts] Error loading products:", error);
    return {};
  }
}

// Save products to file
function saveProducts(products) {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(PRODUCTS_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), "utf8");
    console.log(`[saveProducts] Saved ${Object.keys(products).length} products`);
  } catch (error) {
    console.error("[saveProducts] Error saving products:", error);
    throw error;
  }
}

// Get all products with their active status (from file)
function getAllProducts() {
  return loadProducts();
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

// Load products from file on startup
loadProducts();

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

// Products GET - return all products with active status (from file)
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

// Products POST - save all products to file
app.post("/api/products/save", (req, res) => {
  const { products } = req.body;
  
  // Validate
  if (!products || typeof products !== "object") {
    return res.status(400).json({ ok: false, error: "Products object is required" });
  }
  
  // Validate structure: each product should have planned and active
  const productKeys = Object.keys(products);
  for (const productName of productKeys) {
    const product = products[productName];
    if (typeof product !== "object" || product === null) {
      return res.status(400).json({ ok: false, error: `Invalid product data for "${productName}"` });
    }
    if (typeof product.planned !== "number" || isNaN(product.planned)) {
      return res.status(400).json({ ok: false, error: `Invalid planned quantity for "${productName}"` });
    }
    if (typeof product.active !== "boolean") {
      return res.status(400).json({ ok: false, error: `Invalid active status for "${productName}"` });
    }
  }
  
  // Save to file
  try {
    saveProducts(products);
    res.json({
      ok: true,
      message: `Saved ${productKeys.length} products`,
      count: productKeys.length
    });
  } catch (error) {
    console.error("[POST /api/products/save] Error saving products:", error);
    return res.status(500).json({ ok: false, error: "Failed to save products" });
  }
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

// Products DELETE - remove product from products.json (soft delete)
app.delete("/api/products/:name", (req, res) => {
  const decodedName = decodeURIComponent(req.params.name || "").trim();
  if (!decodedName) {
    return res.status(400).json({ success: false, error: "Product name is required" });
  }

  const products = loadProducts();
  if (!(decodedName in products)) {
    return res.status(404).json({ success: false, error: "Product not found" });
  }

  delete products[decodedName];
  try {
    saveProducts(products);
    res.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/products/:name] Error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete product" });
  }
});

function normalizeName(name) {
  if (!name) return "";
  return name
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .trim()
    .toLowerCase();
}

// Products POST - upload products from .xlsx file (multer file upload)
app.post("/api/upload-products", upload.single("file"), (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ success: false, error: "No file uploaded. Send file under key 'file'." });
  }
  const ext = path.extname(req.file.originalname || "").toLowerCase();
  if (ext !== ".xlsx" && ext !== ".xls") {
    return res.status(400).json({ success: false, error: "File must be .xlsx or .xls" });
  }

  try {
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rowsAsArrays = XLSX.utils.sheet_to_json(worksheet, { header: false, defval: "" });

    const productCol = 0;
    const plannedCol = 1;

    const uploadDateStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;

    // Full replace: spreadsheet is the only source. Do not merge with loadProducts().
    // saveProducts() overwrites products.json entirely — anything not in the sheet is removed.
    const productsObject = {};

    rowsAsArrays.forEach((row) => {
      const values = Array.isArray(row) ? row : Object.values(row);
      const rawName = String(values[productCol] || "").trim();
      const planned = Number(values[plannedCol]);

      if (!rawName || isNaN(planned) || planned < 0) return;

      const norm = normalizeName(rawName);

      if (!productsObject[norm]) {
        productsObject[norm] = {
          displayName: rawName,
          planned: 0,
          active: true
        };
      }

      productsObject[norm].planned += planned;
    });

    // Replace entire catalog — only rows from this spreadsheet (planned summed per normalized name).
    const toSave = {};
    Object.values(productsObject).forEach((p) => {
      toSave[p.displayName] = {
        planned: p.planned,
        active: true,
        dateModified: uploadDateStr
      };
    });

    const count = Object.keys(toSave).length;
    if (count === 0) {
      return res.status(400).json({ success: false, error: "No valid product rows found in Excel file." });
    }

    saveProducts(toSave);
    res.json({ success: true, count });
  } catch (error) {
    console.error("[POST /api/upload-products] Error:", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to process upload" });
  }
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

/** Only count activity rows whose product string matches a key in products.json (ignores orphan / stale names). */
function calculateTotalsByProductForCatalog(entries, allProductsData) {
  const catalogKeys = new Set(Object.keys(allProductsData));
  const totals = {};
  entries.forEach((entry) => {
    const name = entry.product;
    if (!name || !catalogKeys.has(name)) return;
    if (!totals[name]) totals[name] = 0;
    totals[name] += entry.qty || 0;
  });
  return totals;
}

/**
 * Dashboard/summary: product rows come ONLY from loadProducts() (products.json) — no ghost SKUs from old activity.
 * Planned, active, displayName, dateModified are read from that file on every request.
 * Produced / sent / sold counts aggregate in-memory entry arrays, but only rows whose product matches a key in products.json (orphan activity is ignored).
 */
function buildDashboardPayload() {
  const byProduct = {};
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const allProductsData = loadProducts();

  const producedTotals = calculateTotalsByProductForCatalog(store.produced, allProductsData);
  const sentToShopTotals = calculateTotalsByProductForCatalog(store.sentToShop, allProductsData);
  const soldTotals = calculateTotalsByProductForCatalog(store.sold, allProductsData);

  const activeProducts = Object.keys(allProductsData)
    .filter((product) => {
      const productData = allProductsData[product];
      return !productData || productData.active !== false;
    })
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  activeProducts.forEach((product) => {
    const displayName = allProductsData[product]?.displayName || product;
    const planned = allProductsData[product]?.planned ?? 0;
    const produced = producedTotals[product] || 0;
    const sentToShop = sentToShopTotals[product] || 0;
    const sold = soldTotals[product] || 0;
    const net = produced - sentToShop - sold;
    const aheadBehind = produced - planned;
    const dateModified = allProductsData[product]?.dateModified || todayStr;

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
      product: displayName,
      displayName,
      dateModified,
      planned,
      produced,
      sentToShop,
      sold,
      net,
      aheadBehind,
      status,
      statusColor,
    };
  });

  const totals = {
    planned: Object.values(byProduct).reduce((sum, p) => sum + p.planned, 0),
    produced: Object.values(byProduct).reduce((sum, p) => sum + p.produced, 0),
    sentToShop: Object.values(byProduct).reduce((sum, p) => sum + p.sentToShop, 0),
    sold: Object.values(byProduct).reduce((sum, p) => sum + p.sold, 0),
    net: Object.values(byProduct).reduce((sum, p) => sum + p.net, 0),
  };

  const catalog = Object.keys(allProductsData)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .map((key) => {
      const row = allProductsData[key] || {};
      return {
        product: key,
        planned: row.planned ?? 0,
        active: row.active !== false,
        displayName: row.displayName || key,
      };
    });

  return { ok: true, totals, byProduct, catalog };
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

// Dashboard GET — catalog from loadProducts() only; see buildDashboardPayload()
app.get("/api/dashboard", (req, res) => {
  res.json(buildDashboardPayload());
});

// Summary GET — identical payload to /api/dashboard
app.get("/api/summary", (req, res) => {
  res.json(buildDashboardPayload());
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
