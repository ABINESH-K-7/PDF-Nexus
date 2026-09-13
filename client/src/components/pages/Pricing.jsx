import { useEffect, useState } from "react"
import axios from "axios"
import { API_URL } from "../../config/api"
import { ArrowLeft, Check, ChevronDown, CreditCard, Crown, Loader2, Moon, ShieldCheck, Sparkles, Sun } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { getData } from "@/context/userContext"
import { SUBSCRIPTION_PLANS } from "@/lib/subscriptionPlans"
import { openRazorpayCheckout } from "@/components/payment/RazorpayCheckout"


const FAQS = [
  ["What is PDF Nexus?", "PDF Nexus is a document workspace for viewing PDFs, organizing files, and using AI-assisted document chat and analysis."],
  ["What's the difference between Go, Pro and Premium?", "Each paid plan has a different set of planned document, AI, storage, and support allowances. Pro is designed as the balanced option, while Premium is intended for higher-volume work."],
  ["What payment methods are supported?", "Checkout is provided by Razorpay. Available methods are shown securely by Razorpay during checkout."],
  ["Is my payment secure?", "Razorpay handles the payment checkout. PDF Nexus verifies the payment signature on the server before activating a subscription."],
  ["Can I change my plan later?", "Yes. Return to this page to choose another plan. A completed payment grants one month of the plan selected for that order."],
  ["What happens when my plan expires?", "The subscription status returns to Free. Your existing documents are not removed by this subscription flow."],
  ["How are AI questions counted?", "The listed AI question allowances are planned plan capabilities. Usage counting and server-side limit enforcement are not enabled yet."],
  ["Can I upgrade from Go to Pro?", "Yes. Choose Pro on this page; the server records the plan attached to the successfully verified payment."],
  ["Will I lose my documents if my subscription expires?", "No document deletion is performed when a subscription expires. Your access level changes to Free."],
]

const planIcon = (plan) => plan === "go" ? Sparkles : plan === "pro" ? Crown : ShieldCheck

export default function Pricing({ theme, onToggleTheme }) {
  const navigate = useNavigate()
  const { user, setUser } = getData()
  const [subscription, setSubscription] = useState(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [loadingPlan, setLoadingPlan] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [openFaq, setOpenFaq] = useState(null)

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("accessToken")}` })
  const loadStatus = async () => {
    const { data } = await axios.get(`${API_URL}/payment/status`, { headers: headers() })
    setSubscription(data.subscription)
    setUser((current) => current ? { ...current, subscription: data.subscription } : current)
    return data.subscription
  }

  useEffect(() => {
    loadStatus().catch(() => setError("Unable to load your current subscription."))
      .finally(() => setLoadingStatus(false))
  }, [])

  const choosePlan = async (plan) => {
    setLoadingPlan(plan.id)
    setError("")
    setSuccess("")
    try {
      const { data } = await axios.post(`${API_URL}/payment/create-order`, { plan: plan.id }, { headers: headers() })
      const payment = await openRazorpayCheckout({
        order: data.order,
        keyId: data.keyId,
        name: user?.username || user?.name || "",
        email: user?.email || ""
      })
      await axios.post(`${API_URL}/payment/verify`, payment, { headers: headers() })
      const refreshedSubscription = await loadStatus()
      const planName = SUBSCRIPTION_PLANS.find((item) => item.id === refreshedSubscription.plan)?.name || plan.name
      setSuccess(`Payment successful! Welcome to PDF Nexus ${planName}.`)
      toast.success(`Welcome to PDF Nexus ${planName}`)
    } catch (requestError) {
      if (requestError.message !== "Payment cancelled.") {
        setError(requestError.response?.data?.message || requestError.message || "Unable to complete payment. Please try again.")
      }
    } finally {
      setLoadingPlan("")
    }
  }

  return <main className="min-h-[100dvh] bg-neutral-900 text-neutral-100">
    <header className="border-b border-neutral-800 bg-neutral-900">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <button onClick={() => navigate("/")} className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white"><ArrowLeft size={17} />Back</button>
        <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600"><Sparkles size={18} /></span><span className="font-semibold tracking-tight">PDF Nexus</span><button onClick={onToggleTheme} className="ml-1 rounded-lg p-2 text-neutral-300 hover:bg-neutral-800" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button></div>
      </div>
    </header>

    <section className="mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl text-center"><span className="inline-flex rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-sm font-medium text-blue-400">Upgrade Plan</span><h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">Unlock the full power of PDF Nexus</h1><p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-neutral-400 sm:text-lg">Get more from your documents with AI-powered analysis, higher limits and premium features.</p></div>
      {error && <p role="alert" className="mx-auto mt-8 max-w-3xl rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      {success && <p role="status" className="mx-auto mt-8 max-w-3xl rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{success}</p>}

      <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const Icon = planIcon(plan.id)
          const isCurrent = subscription?.plan === plan.id && subscription?.status === "active"
          return <article key={plan.id} className={`relative flex min-w-0 flex-col rounded-2xl border bg-neutral-800 p-6 shadow-sm ${plan.popular ? "border-blue-500 ring-1 ring-blue-500/50" : "border-neutral-700"}`}>
            {plan.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">Most Popular</span>}
            <div className="flex items-center gap-3"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${plan.popular ? "bg-blue-600 text-white" : "bg-neutral-700 text-blue-400"}`}><Icon size={21} /></span><h2 className="text-xl font-semibold">{plan.name}</h2></div>
            <p className="mt-5 min-h-12 text-sm leading-6 text-neutral-400">{plan.description}</p>
            <p className="mt-6 text-4xl font-semibold">₹{plan.price}<span className="ml-1 text-base font-normal text-neutral-400">/ month</span></p>
            <ul className="mt-7 flex-1 space-y-3 border-t border-neutral-700 pt-6 text-sm text-neutral-300">{plan.features.map((feature) => <li key={feature} className="flex gap-3"><Check className="mt-0.5 shrink-0 text-blue-400" size={16} />{feature}</li>)}</ul>
            <button type="button" disabled={loadingStatus || Boolean(loadingPlan) || isCurrent} onClick={() => choosePlan(plan)} className={`mt-8 flex min-h-11 w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${plan.popular ? "bg-blue-600 text-white hover:bg-blue-500" : "bg-neutral-700 text-neutral-100 hover:bg-neutral-600"}`}>{loadingPlan === plan.id ? <><Loader2 className="mr-2 animate-spin" size={16} />Creating secure checkout...</> : isCurrent ? "Current plan" : `Choose ${plan.name}`}</button>
          </article>
        })}
      </div>
      <p className="mt-5 text-center text-xs leading-5 text-neutral-500">Plan allowances are planned capabilities. Usage counting and server-side feature-limit enforcement are not enabled yet.</p>

      <section className="mx-auto mt-20 max-w-3xl"><h2 className="text-center text-3xl font-semibold">Frequently Asked Questions</h2><div className="mt-8 overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-800">{FAQS.map(([question, answer], index) => <div key={question} className="border-b border-neutral-700 last:border-b-0"><button type="button" onClick={() => setOpenFaq(openFaq === index ? null : index)} aria-expanded={openFaq === index} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium hover:bg-neutral-700/60"><span>{question}</span><ChevronDown size={18} className={`shrink-0 text-neutral-400 transition-transform ${openFaq === index ? "rotate-180" : ""}`} /></button><div className={`grid transition-[grid-template-rows] duration-200 ${openFaq === index ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}><div className="overflow-hidden"><p className="px-5 pb-4 text-sm leading-6 text-neutral-400">{answer}</p></div></div></div>)}</div></section>

      <section className="mx-auto mt-12 max-w-3xl rounded-2xl border border-neutral-700 bg-neutral-800 p-6 text-center"><CreditCard className="mx-auto text-blue-400" size={23} /><h2 className="mt-3 text-lg font-semibold">Need help?</h2><p className="mt-2 text-sm text-neutral-400">Have questions about your plan or payment?</p><button type="button" className="mt-4 rounded-lg border border-neutral-600 px-4 py-2 text-sm font-medium hover:bg-neutral-700">Contact Support</button></section>
      <p className="mt-10 flex items-center justify-center gap-2 text-sm text-neutral-500"><ShieldCheck size={16} />Secure payments powered by Razorpay</p>
    </section>
  </main>
}
