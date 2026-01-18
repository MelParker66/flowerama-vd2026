import { API_BASE_URL } from "../config";

const API_BASE = `${API_BASE_URL}/api`;

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
  const response = await fetch(`${API_BASE_URL}/api/warehouse`, {
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
  const response = await fetch(`${API_BASE_URL}/api/produced`, {
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
  const response = await fetch(`${API_BASE_URL}/api/sent-to-shop`, {
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
  const response = await fetch(`${API_BASE_URL}/api/sent-to-shop`);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const data = await response.json();
  return data.entries || [];
}

// Sold API
export async function saveSoldEntry(date, product, qty) {
  const response = await fetch(`${API_BASE_URL}/api/sold`, {
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
  const response = await fetch(`${API_BASE_URL}/api/history`);
  
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
  const response = await fetch(`${API_BASE_URL}/api/dashboard`);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  return response.json();
}

// Planned API - returns only active products
export async function fetchPlannedProducts() {
  const response = await fetch(`${API_BASE_URL}/api/planned`);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const data = await response.json();
  return Object.keys(data.plannedByProduct || {});
}

// Products API
export async function fetchAllProducts() {
  const response = await fetch(`${API_BASE_URL}/api/products`);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const data = await response.json();
  return data.products || [];
}

export async function deactivateProduct(productName) {
  const response = await fetch(`${API_BASE_URL}/api/products/deactivate`, {
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
  const response = await fetch(`${API_BASE_URL}/api/products/reactivate`, {
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
  const response = await fetch(`${API_BASE_URL}/api/planned`, {
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

