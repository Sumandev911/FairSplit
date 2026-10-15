// Run: npm test
import assert from 'node:assert'
import { balances, settle } from './split.js'

const people = ['Asha', 'Ravi', 'Meera']
const exp = [
  { amount: 30000, paidBy: 'Asha', splitAmong: people }, // 300 split 3 ways
  { amount: 1000, paidBy: 'Ravi', splitAmong: ['Ravi', 'Meera'] }, // 10 split 2 ways
]
const bal = balances(people, exp)
assert.deepEqual(bal, { Asha: 20000, Ravi: -9500, Meera: -10500 })
assert.equal(Object.values(bal).reduce((a, b) => a + b, 0), 0) // money is conserved

const plan = settle(bal)
assert.deepEqual(plan, [
  { from: 'Meera', to: 'Asha', amount: 10500 },
  { from: 'Ravi', to: 'Asha', amount: 9500 },
])

// Odd cents: 100 split 3 ways never loses a paisa
const odd = balances(['A', 'B', 'C'], [{ amount: 100, paidBy: 'A', splitAmong: ['A', 'B', 'C'] }])
assert.equal(Object.values(odd).reduce((a, b) => a + b, 0), 0)

// Applying the plan as payments brings everyone to zero
const after = balances(people, [...exp, ...plan.map((p) => ({ amount: p.amount, paidBy: p.from, splitAmong: [p.to] }))])
assert.ok(Object.values(after).every((v) => v === 0))

console.log('split tests passed')
