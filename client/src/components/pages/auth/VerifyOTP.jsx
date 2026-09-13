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
import axios from "axios"
import { API_URL } from "../../../config/api"
import { CheckCircle, Loader2, RotateCcw } from "lucide-react"
import { useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"

const VerifyOTP = () => {
  const { email } = useParams()
  const navigate = useNavigate()

  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [verified, setVerified] = useState(false)

  const inputRefs = useRef([])

  const handleChange = (index, value) => {
    if (!/^\d?$/.test(value)) return

    const next = [...otp]
    next[index] = value
    setOtp(next)

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleVerify = async () => {
    const code = otp.join("")
    if (code.length !== 6) {
      setError("Enter all 6 digits")
      return
    }

    try {
      setError("")
      setLoading(true)
      const res = await axios.post(
        `${API_URL}/user/verify-otp`,
        { 
            email,
            otp: code 
        }
      )
console.log("Sending OTP:", { email, otp: code })

      setVerified(true)

      setTimeout(() => {
        navigate(`/change-password/${res.data.resetToken}`)
      }, 2000)
    } catch (err) {
      setError(err.response?.data?.message || "Invalid OTP")
    } finally {
      setLoading(false)
    }
  }

  const clearOtp = () => {
    setOtp(["", "", "", "", "", ""])
    setError("")
    inputRefs.current[0]?.focus()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-900 px-4">
      <div className="w-full max-w-md">
        <Card className="bg-neutral-800 border border-neutral-700 shadow-xl">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl text-white">
              Verify OTP
            </CardTitle>
            <CardDescription className="text-neutral-400">
              We sent a 6-digit code to{" "}
              <span className="text-white font-medium">{email}</span>
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {verified ? (
              <div className="py-6 flex flex-col items-center text-center space-y-4">
                <div className="bg-blue-500/10 rounded-full p-3">
                  <CheckCircle className="w-6 h-6 text-blue-500" />
                </div>

                <p className="text-white font-medium">
                  OTP verified successfully
                </p>

                <div className="flex items-center gap-2 text-neutral-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Redirecting…
                </div>
              </div>
            ) : (
              <>
                {/* OTP INPUTS */}
                <div className="flex justify-between">
                  {otp.map((digit, i) => (
                    <Input
                      key={i}
                      ref={(el) => (inputRefs.current[i] = el)}
                      value={digit}
                      onChange={(e) => handleChange(i, e.target.value)}
                      maxLength={1}
                      className="w-12 h-12 text-center text-lg font-semibold"
                    />
                  ))}
                </div>

                {/* ACTIONS */}
                <div className="space-y-3">
                  <Button
                    onClick={handleVerify}
                    disabled={loading || otp.some(d => d === "")}
                    className="w-full bg-blue-600 hover:bg-blue-500"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying…
                      </>
                    ) : (
                      "Verify Code"
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={clearOtp}
                    disabled={loading}
                    className="w-full"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                </div>
              </>
            )}
          </CardContent>

          <CardFooter className="justify-center">
            <p className="text-sm text-neutral-400">
              Wrong email?{" "}
              <Link
                to="/forgot-password"
                className="text-blue-500 hover:underline"
              >
                Go back
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

export default VerifyOTP
