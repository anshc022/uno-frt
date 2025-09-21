// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// Helper function to create full API URLs
export const getApiUrl = (endpoint) => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
};

// Helper function for API fetch with automatic URL prefixing
export const apiFetch = (endpoint, options = {}) => {
  const url = getApiUrl(endpoint);
  return fetch(url, options);
};

export default API_BASE_URL;