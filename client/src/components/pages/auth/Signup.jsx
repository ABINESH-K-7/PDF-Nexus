import { useState } from "react"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Link, useNavigate } from "react-router-dom"
import axios from "axios"
import { API_URL } from "../../../config/api"
import { AIChatIcon } from "@/components/Topbar"

const Signup = () => {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({ username: "", email: "", password: "" })
  const handleChange = (event) => setFormData((previous) => ({ ...previous, [event.target.name]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!formData.username || !formData.email || !formData.password) return toast.error("All fields are required")
    try {
      setIsLoading(true)
      const response = await axios.post(`${API_URL}/user/register`, formData, { headers: { "Content-Type": "application/json" } })
      if (response.data?.success) {
        toast.success(response.data.message || "Account created")
        navigate("/verify")
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Signup failed")
    } finally {
      setIsLoading(false)
    }
  }

  return <main className="min-h-screen w-full bg-neutral-900 px-4 py-8 text-neutral-200 sm:flex sm:items-center sm:justify-center">
    <section className="mx-auto w-full max-w-md rounded-2xl border border-neutral-700 bg-neutral-800 p-6 shadow-2xl shadow-black/20 sm:p-8">
      <header className="mb-7 text-center"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/15 ring-1 ring-blue-400/30"><AIChatIcon className="h-8 w-8" /></div><h1 className="text-3xl font-semibold tracking-tight text-neutral-100">PDF Nexus</h1><p className="mt-2 text-sm leading-6 text-neutral-400">Create your account to explore documents with AI.</p></header>
      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block text-sm font-medium text-neutral-300">Full Name<input name="username" value={formData.username} onChange={handleChange} placeholder="Your name" required className="mt-2 h-11 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20" /></label>
        <label className="block text-sm font-medium text-neutral-300">Email<input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="you@example.com" required className="mt-2 h-11 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20" /></label>
        <label className="block text-sm font-medium text-neutral-300">Password<div className="relative mt-2"><input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} required className="h-11 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 pr-11 text-sm text-neutral-100 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-neutral-400 hover:text-neutral-200" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
        <button type="submit" disabled={isLoading} className="flex h-11 w-full items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60">{isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account...</> : "Sign up"}</button>
      </form>
      <p className="mt-6 text-center text-sm text-neutral-400">Already have an account? <Link to="/login" className="font-medium text-blue-400 hover:text-blue-300 hover:underline">Login</Link></p>
    </section>
  </main>
}

export default Signup
