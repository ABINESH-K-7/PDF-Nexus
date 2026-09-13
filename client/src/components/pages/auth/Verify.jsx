import { useEffect, useState } from "react"
import axios from "axios"
import { API_URL } from "../../../config/api"
import { useNavigate, useParams } from "react-router-dom"
import { Loader2, CheckCircle, XCircle } from "lucide-react"

const Verify = () => {
  const { token } = useParams()
  const navigate = useNavigate()

  const [status, setStatus] = useState("loading") // loading | success | error
  const [message, setMessage] = useState("Verifying your email...")

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const res = await axios.post(
          `${API_URL}/user/verify`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        )

        if (res.data?.success) {
          setStatus("success")
          setMessage("Email verified successfully")

          setTimeout(() => {
            navigate("/login")
          }, 2000)
        } else {
          setStatus("error")
          setMessage("Invalid or expired verification link")
        }
      } catch (error) {
        setStatus("error")
        setMessage(
          error.response?.data?.message ||
            "Verification failed. Please try again."
        )
      }
    }

    if (token) verifyEmail()
  }, [token, navigate])

  return (
    <div className="w-full h-screen flex items-center justify-center bg-neutral-900 text-neutral-200">
      <div className="bg-neutral-800 border border-neutral-700 p-8 rounded-xl text-center max-w-md w-full space-y-4">
        {status === "loading" && (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-green-500" />
            <p>{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="mx-auto h-10 w-10 text-green-500" />
            <p className="text-green-400">{message}</p>
            <p className="text-sm text-gray-400">
              Redirecting to login...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="mx-auto h-10 w-10 text-red-500" />
            <p className="text-red-400">{message}</p>
            <button
              onClick={() => navigate("/signup")}
              className="mt-4 text-green-500 hover:underline"
            >
              Go back to signup
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default Verify
