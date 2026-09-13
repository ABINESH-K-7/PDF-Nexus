import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "../config/api";

export const UserContext = createContext(null)

export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

useEffect(() => {
    const token = localStorage.getItem("accessToken");

    if (token) {
      axios
        .get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then(res => res.data.success ? setUser(res.data.user) : null)
        .catch((err) => localStorage.removeItem("accessToken"))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);




    return <UserContext.Provider value={{ user, setUser, loading }}>
        {children}
    </UserContext.Provider>
}

export const getData = () => useContext(UserContext)
