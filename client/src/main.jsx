import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { UserProvider } from "@/context/userContext"
import App from "./App"
import "./index.css"
import { Toaster } from "sonner"
ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
   <UserProvider>
      <App />
        <Toaster richColors position="top-center" />

    </UserProvider>
  </BrowserRouter>
)
