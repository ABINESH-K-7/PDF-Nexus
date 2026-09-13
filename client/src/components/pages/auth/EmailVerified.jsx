import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { CheckCircle } from "lucide-react"

const EmailVerified = () => {
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/login")
    }, 2000)

    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-white">
      <div className="text-center">
        <CheckCircle className="mx-auto mb-3 text-green-500" size={42} />
        <p className="text-lg font-semibold">Email verified successfully 🎉</p>
        <p className="text-sm text-neutral-400">Redirecting to login…</p>
      </div>
    </div>
  )
}

export default EmailVerified
