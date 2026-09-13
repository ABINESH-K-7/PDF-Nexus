import { CheckCircle } from "lucide-react"
import React, { useEffect } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"



const VerifyEmail = () => {
    const { token } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/login")
    }, 2500)

    return () => clearTimeout(timer)
  }, [navigate])
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-900 px-4">
      <div className="w-full max-w-md bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl p-6 text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-blue-500/10 rounded-full p-3">
            <CheckCircle className="w-6 h-6 text-blue-500" />
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-white mb-3">
          Check your email
        </h2>

        <p className="text-sm text-neutral-400 mb-6">
          We’ve sent a verification link to your email address.
          <br />
          Please open your inbox and click the link to verify your account.
        </p>

        <p className="text-sm text-neutral-500">
          Didn’t receive the email?{" "}
          <Link
            to="/login"
            className="text-blue-500 hover:underline font-medium"
          >
            Back to login
          </Link>
        </p>
      </div>
    </div>
  )
}

export default VerifyEmail
