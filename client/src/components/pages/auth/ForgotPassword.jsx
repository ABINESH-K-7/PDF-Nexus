import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import axios from "axios"
import { API_URL } from "../../../config/api"
import { CheckCircle, Loader2 } from "lucide-react"
import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"

const ForgotPassword = () => {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
//   const [submitted, setSubmitted] = useState(false)

  const navigate = useNavigate()

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setError("")

    if (!email) {
      setError("Email is required")
      return
    }

    try {
      setLoading(true)

      const res = await axios.post(
        `${API_URL}/user/forgot-password`,
        { email }
      )

      if (res.data.success) {
          toast.success("OTP sent to your email")
          navigate(`/verify-otp/${email}`)
      } 
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

   return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-900 px-4">
      <Card className="bg-neutral-800 border border-neutral-700 shadow-xl w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-white">Forgot Password</CardTitle>
          <CardDescription className="text-neutral-400">
            Enter your email to receive an OTP
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <Button disabled={loading} className="w-full">
              {loading ? "Sending..." : "Send OTP"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default ForgotPassword
