import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import axios from "axios"
import { API_URL } from "../../../config/api"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { toast } from "sonner"

const CreatePassword = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email

  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleCreatePassword = async () => {
    if (!password) {
      toast.error("Password required")
      return
    }

    try {
      setLoading(true)

      const res = await axios.post(
        `${API_URL}/user/set-password`,
        { email, password }
      )

      toast.success(res.data.message)
      navigate("/login")

    } catch (err) {
      toast.error(err.response?.data?.message || "Error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-900 px-4">
      <div className="w-full max-w-md bg-neutral-800 p-6 rounded-lg border border-neutral-700">
        <h2 className="text-2xl text-white text-center mb-4">
          Create a Password
        </h2>

        <Input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button
          onClick={handleCreatePassword}
          disabled={loading}
          className="w-full mt-4 bg-green-600 hover:bg-green-500"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Password"
          )}
        </Button>
      </div>
    </div>
  )
}

export default CreatePassword
