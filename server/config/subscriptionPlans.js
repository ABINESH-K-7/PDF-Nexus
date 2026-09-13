export const SUBSCRIPTION_PLANS = Object.freeze({
  go: { id: "go", amount: 9900, currency: "INR" },
  pro: { id: "pro", amount: 29900, currency: "INR" },
  premium: { id: "premium", amount: 49900, currency: "INR" }
})

export const isPaidPlan = (plan) => Object.hasOwn(SUBSCRIPTION_PLANS, plan)
