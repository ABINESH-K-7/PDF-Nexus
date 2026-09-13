// Only this public API origin is exposed to browser code by Vite.
export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "")
