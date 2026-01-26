import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to normalize product name to Title Case
function normalizeProductName(name) {
  if (!name || typeof name !== "string") return "";
  
  // Trim whitespace
  let normalized = name.trim();
  
  // Replace multiple spaces with single space
  normalized = normalized.replace(/\s+/g, " ");
  
  // Normalize hyphens (remove spaces around hyphens, ensure single hyphen)
  normalized = normalized.replace(/\s*-\s*/g, "-");
  normalized = normalized.replace(/-+/g, "-");
  
  // Convert to Title Case
  // Split by spaces, hyphens, parentheses, and slashes
  normalized = normalized
    .split(/([\s\-/()&]+)/)
    .map((part) => {
      // If it's a separator, keep it as is
      if (/^[\s\-/()&]+$/.test(part)) {
        return part;
      }
      // Handle special abbreviations that should stay uppercase
      const upperPart = part.toUpperCase();
      if (upperPart === "SM" || upperPart === "MD" || upperPart === "LG" || 
          upperPart === "XL" || upperPart === "DX" ||
          upperPart === "S" || upperPart === "M" || upperPart === "L" ||
          upperPart === "DZ" || upperPart === "W/") {
        return upperPart;
      }
      // Handle case variations like "Xl" -> "XL", "Dx" -> "DX"
      if (upperPart === "XL" && part !== "XL") return "XL";
      if (upperPart === "DX" && part !== "DX") return "DX";
      // Otherwise, capitalize first letter, lowercase the rest
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");
  
  // Fix common patterns: "W/" should be "w/" (lowercase w)
  normalized = normalized.replace(/\bW\//g, "w/");
  
  return normalized;
}

// Function to read Excel file and extract products
function readExcelFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Excel file not found at ${filePath}`);
  }
  
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Read as arrays (no header row)
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: false, defval: "" });
  
  const products = new Map(); // Use Map to handle duplicates
  
  rows.forEach((row) => {
    const values = Array.isArray(row) ? row : Object.values(row);
    
    if (values.length < 2) return;
    
    // Column A = Planned Quantity (index 0)
    // Column B = Product Name (index 1)
    const planned = Number(values[0]);
    const productName = String(values[1] || "").trim();
    
    // Skip if product name is empty or planned is not a valid number
    if (!productName || isNaN(planned)) return;
    
    // Normalize product name
    const normalizedName = normalizeProductName(productName);
    
    if (!normalizedName) return;
    
    // Handle duplicates - if same normalized name exists, sum the quantities
    if (products.has(normalizedName)) {
      products.set(normalizedName, products.get(normalizedName) + planned);
    } else {
      products.set(normalizedName, planned);
    }
  });
  
  return products;
}

// Main function
function main() {
  const excelPath = "C:/Users/Doug/Documents/FloweramaFresh/UpdateVD2026.xlsx";
  const overridesPath = path.join(__dirname, "planned-overrides.json");
  
  console.log("Reading Excel file...");
  const products = readExcelFile(excelPath);
  
  console.log(`Found ${products.size} unique products after normalization`);
  
  // Convert Map to object format for planned-overrides.json
  const overrides = {};
  products.forEach((planned, productName) => {
    overrides[productName] = {
      planned: planned,
      active: true
    };
  });
  
  // Write to planned-overrides.json
  console.log("Writing to planned-overrides.json...");
  fs.writeFileSync(overridesPath, JSON.stringify(overrides, null, 2), "utf8");
  
  console.log("Done! Updated planned-overrides.json with normalized products.");
  console.log("\nSample products:");
  const sampleProducts = Array.from(products.keys()).slice(0, 10);
  sampleProducts.forEach(name => {
    console.log(`  - ${name}: ${products.get(name)}`);
  });
}

main();

