import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import axios from "axios"
import { API_URL } from "../../../config/api"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

const ChangePassword = () => {
  const { token } = useParams()
  const navigate = useNavigate()

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

  const handleChangePassword = async () => {
    setError("")
    setSuccess("")

    if (!newPassword || !confirmPassword) {
      setError("Please fill in all fields")
      return
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    try {
      setLoading(true)

      const res = await axios.post(
        `${API_URL}/user/change-password`,
        { token, newPassword , confirmPassword}
      )


      setSuccess(res.data.message || "Password changed successfully")

      setTimeout(() => {
        navigate("/login")
      }, 2000)
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-900 px-4">
      <div className="w-full max-w-md bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl p-6">
        <h2 className="text-2xl font-semibold text-white text-center mb-2">
          Change Password
        </h2>

        <p className="text-sm text-neutral-400 text-center mb-5">
          Enter your new password
        </p>

        {error && (
          <p className="text-red-400 text-sm mb-3 text-center">{error}</p>
        )}

        {success && (
          <p className="text-green-400 text-sm mb-3 text-center">{success}</p>
        )}

        <div className="space-y-4">
          <Input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <Input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <Button
            className="w-full bg-blue-600 hover:bg-blue-500"
            onClick={handleChangePassword}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Changing...
              </>
            ) : (
              "Change Password"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ChangePassword
