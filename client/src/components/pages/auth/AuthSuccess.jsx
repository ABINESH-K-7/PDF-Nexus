import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import { API_URL } from "../../../config/api"
import { getData } from "@/context/userContext"
import { Loader2, XCircle } from "lucide-react"

const AuthSuccess = () => {
  const { setUser } = getData()
  const navigate = useNavigate()

  const [status, setStatus] = useState("loading") // loading | error
  const [message, setMessage] = useState("Logging you in...")

  useEffect(() => {
    const handleAuth = async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const accessToken = params.get("token")

        if (!accessToken) {
          setStatus("error")
          setMessage("Authentication token missing")
          return
        }

        localStorage.setItem("accessToken", accessToken)

        const res = await axios.get(
          `${API_URL}/auth/me`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        )

        if (res.data?.success) {
          setUser(res.data.user)
          navigate("/")
        } else {
          throw new Error("Authentication failed")
        }
      } catch (error) {
        console.error(error)
        setStatus("error")
        setMessage(
          error.response?.data?.message ||
          "Authentication failed. Please login again."
        )
        setTimeout(() => navigate("/login"), 2500)
      }
    }

    handleAuth()
  }, [navigate, setUser])

  return (
    <div className="w-full h-screen flex items-center justify-center bg-neutral-900 text-neutral-200">
      <div className="bg-neutral-800 border border-neutral-700 p-8 rounded-xl text-center max-w-md w-full space-y-4">
        {status === "loading" ? (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-green-500" />
            <p>{message}</p>
          </>
        ) : (
          <>
            <XCircle className="mx-auto h-8 w-8 text-red-500" />
            <p className="text-red-400">{message}</p>
          </>
        )}
      </div>
    </div>
  )
}

export default AuthSuccess
