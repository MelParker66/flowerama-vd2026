// frontend/src/config.js

// Use environment variable in production, fallback to "/api" for local dev
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

