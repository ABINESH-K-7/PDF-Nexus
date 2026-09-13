const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js"

const loadRazorpayScript = () => new Promise((resolve, reject) => {
  if (window.Razorpay) return resolve()
  const script = document.createElement("script")
  script.src = RAZORPAY_SCRIPT
  script.onload = resolve
  script.onerror = () => reject(new Error("Unable to load Razorpay Checkout."))
  document.head.appendChild(script)
})

export async function openRazorpayCheckout({ order, keyId, name, email }) {
  await loadRazorpayScript()
  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      key: keyId,
      amount: order.amount,
      currency: order.currency,
      name: "PDF Nexus",
      description: "PDF Nexus Pro — monthly plan",
      order_id: order.id,
      prefill: { name, email },
      theme: { color: "#2563eb" },
      handler: resolve,
      modal: { ondismiss: () => reject(new Error("Payment cancelled.")) }
    })
    checkout.open()
  })
}
