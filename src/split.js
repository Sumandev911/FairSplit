// Core money logic. All amounts are integer cents (paise) to avoid float errors.

// Net balance per member: positive = should receive, negative = owes.
export function balances(members, expenses) {
  const bal = Object.fromEntries(members.map((m) => [m, 0]))
  for (const e of expenses) {
    const n = e.splitAmong.length
    const share = Math.floor(e.amount / n)
    let extra = e.amount - share * n // leftover cents go to the first few people
    bal[e.paidBy] += e.amount
    for (const m of e.splitAmong) {
      bal[m] -= share + (extra-- > 0 ? 1 : 0)
    }
  }
  return bal
}

// Greedy settle-up: always match the biggest debtor with the biggest creditor.
// Produces at most (members - 1) payments.
export function settle(bal) {
  const debtors = [], creditors = []
  for (const [name, amt] of Object.entries(bal)) {
    if (amt < 0) debtors.push({ name, amt: -amt })
    else if (amt > 0) creditors.push({ name, amt })
  }
  const byAmt = (a, b) => b.amt - a.amt
  const out = []
  while (debtors.length && creditors.length) {
    debtors.sort(byAmt); creditors.sort(byAmt)
    const d = debtors[0], c = creditors[0]
    const pay = Math.min(d.amt, c.amt)
    out.push({ from: d.name, to: c.name, amount: pay })
    d.amt -= pay; c.amt -= pay
    if (!d.amt) debtors.shift()
    if (!c.amt) creditors.shift()
  }
  return out
}

export const toCents = (n) => Math.round(Number(n) * 100)
// Whole amounts drop the ".00" so big figures stay readable.
export const money = (cents, currency) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100)
