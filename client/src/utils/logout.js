import axios from "axios"
import { API_URL } from "../config/api"

// Keeps every frontend logout surface on the existing logout endpoint.
export async function logoutUser() {
  const accessToken = localStorage.getItem("accessToken")
  try {
    if (accessToken) {
      await axios.post(`${API_URL}/user/logout`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
    }
  } finally {
    localStorage.removeItem("accessToken")
  }
}
