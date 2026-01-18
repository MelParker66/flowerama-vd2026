const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? "/api" : "http://localhost:3001/api");

// Helper to make API calls
async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  };

  if (config.body && typeof config.body === "object") {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(url, config);
    
    // Handle non-JSON responses
    let data;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = { message: await response.text() || `HTTP ${response.status}` };
    }
    
    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }
    
    return data;
  } catch (error) {
    // Handle network errors
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      throw new Error("Network error: Could not connect to server");
    }
    throw error;
  }
}

// Warehouse API
export async function saveWarehouseEntry(date, product, quantity) {
  const apiBase = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? "" : "http://localhost:3001");
  const response = await fetch(`${apiBase}/api/warehouse`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ date, product, quantity }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Produced API
export async function saveProducedEntry(date, product, qty) {
  const apiBase = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? "" : "http://localhost:3001");
  const response = await fetch(`${apiBase}/api/produced`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ date, product, qty }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Sent to Shop API
export async function saveSentToShopEntry(date, product, quantity) {
  const apiBase = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? "" : "http://localhost:3001");
  const response = await fetch(`${apiBase}/api/sent-to-shop`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ date, product, quantity }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Get Sent to Shop entries (for history later)
export async function getSentToShopEntries() {
  const apiBase = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? "" : "http://localhost:3001");
  const response = await fetch(`${apiBase}/api/sent-to-shop`);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const data = await response.json();
  return data.entries || [];
}

// Sold API
export async function saveSoldEntry(date, product, qty) {
  const apiBase = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? "" : "http://localhost:3001");
  const response = await fetch(`${apiBase}/api/sold`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ date, product, qty }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// History API
export async function fetchHistory() {
  const apiBase = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? "" : "http://localhost:3001");
  const response = await fetch(`${apiBase}/api/history`);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const data = await response.json();
  return data.history || [];
}

// Dashboard API
export async function fetchDashboardData() {
  return apiCall("/dashboard");
}

export async function fetchDashboardSummary() {
  const response = await fetch("http://localhost:3001/dashboard/summary");
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  return response.json();
}

// Planned API - returns only active products
export async function fetchPlannedProducts() {
  const apiBase = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? "" : "http://localhost:3001");
  const response = await fetch(`${apiBase}/api/planned`);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const data = await response.json();
  return Object.keys(data.plannedByProduct || {});
}

// Products API
export async function fetchAllProducts() {
  const apiBase = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? "" : "http://localhost:3001");
  const response = await fetch(`${apiBase}/api/products`);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const data = await response.json();
  return data.products || [];
}

export async function deactivateProduct(productName) {
  const apiBase = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? "" : "http://localhost:3001");
  const response = await fetch(`${apiBase}/api/products/deactivate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ productName }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

export async function reactivateProduct(productName) {
  const apiBase = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? "" : "http://localhost:3001");
  const response = await fetch(`${apiBase}/api/products/reactivate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ productName }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

export async function savePlannedEntry(product, planned) {
  const apiBase = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? "" : "http://localhost:3001");
  const response = await fetch(`${apiBase}/api/planned`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ product, planned }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

