import { useEffect, useRef, useState } from 'react'
import { balances, settle, toCents, money } from './split.js'
import Icon from './icons.jsx'
import './App.css'

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'THB', 'JPY']
const CATEGORIES = { food: 'Food', travel: 'Travel', stay: 'Stay', shopping: 'Shopping', bills: 'Bills', other: 'Other' }

// Frankfurter: free exchange-rate API, no key needed
async function rate(from, to) {
  if (from === to) return 1
  const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`)
  if (!res.ok) throw new Error("Couldn't get today's exchange rate. Check your internet and try again.")
  return (await res.json()).rates[to]
}

const uid = () => crypto.randomUUID()
const today = () => new Date().toISOString().slice(0, 10)

function loadGroups() {
  try { return JSON.parse(localStorage.getItem('fairsplit')) || [] } catch { return [] }
}

function sampleGroup() {
  const members = ['Asha', 'Ravi', 'Meera', 'Kiran']
  const e = (description, amt, paidBy, category, date, splitAmong = members) =>
    ({ id: uid(), description, amount: toCents(amt), paidBy, category, splitAmong, date })
  return {
    id: uid(), name: 'Goa Trip', currency: 'INR', members, me: 'Asha',
    expenses: [
      e('Breakfast at Infantaria', 840, 'Asha', 'food', '2026-10-06'),
      e('Scooter rental', 1500, 'Kiran', 'travel', '2026-10-06', ['Kiran', 'Ravi']),
      e('Seafood dinner', 3200, 'Meera', 'food', '2026-10-05'),
      e('Beach villa, 2 nights', 9600, 'Ravi', 'stay', '2026-10-05'),
      e('Train tickets', 4800, 'Asha', 'travel', '2026-10-04'),
    ],
  }
}

// tone = member's position in the group, so nobody in a group shares a colour
function Avatar({ name, tone, size = 'md' }) {
  return <span className={`avatar ${size}`} data-tone={tone % 6} aria-hidden="true">{name[0].toUpperCase()}</span>
}

function AvatarStack({ names }) {
  return <span className="stack">{names.slice(0, 5).map((n, i) => <Avatar key={n} name={n} tone={i} size="sm" />)}</span>
}

const dayLabel = (d) => new Date(d + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

export default function App() {
  const [groups, setGroups] = useState(loadGroups)
  const [activeId, setActiveId] = useState(null)
  const [creating, setCreating] = useState(false)
  const active = groups.find((g) => g.id === activeId)

  useEffect(() => { localStorage.setItem('fairsplit', JSON.stringify(groups)) }, [groups])

  // Light/dark: starts from the device setting, the button overrides it and is remembered.
  const [theme, setTheme] = useState(() => localStorage.getItem('fairsplit-theme')
    || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'))
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('fairsplit-theme', theme)
  }, [theme])

  const addGroup = (g) => { setGroups([...groups, g]); setActiveId(g.id); setCreating(false) }
  const updateGroup = (g) => setGroups(groups.map((x) => (x.id === g.id ? g : x)))
  const deleteGroup = (id) => {
    if (!confirm('Delete this group and all its expenses? This cannot be undone.')) return
    setGroups(groups.filter((g) => g.id !== id)); setActiveId(null)
  }

  return (
    <div className={`app ${active ? 'has-group' : ''}`}>
      <aside className="groups-pane">
        <header className="pane-head">
          <h1>FairSplit</h1>
          <div className="head-actions">
            <button className="icon-btn theme-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
            <button className="btn small" onClick={() => setCreating(true)}><Icon name="plus" size={18} />New group</button>
          </div>
        </header>
        {groups.length ? (
          <ul className="list grouped">
            {groups.map((g) => <GroupRow key={g.id} group={g} on={g.id === activeId} onOpen={() => setActiveId(g.id)} />)}
          </ul>
        ) : (
          <div className="empty">
            <span className="empty-icon"><Icon name="users" size={28} /></span>
            <h2>Split your first trip</h2>
            <p>Make a group for a trip, hostel room or flat. Log who paid, and FairSplit works out the fewest payments to settle up.</p>
            <button className="btn" onClick={() => setCreating(true)}>Create a group</button>
            <button className="btn ghost" onClick={() => addGroup(sampleGroup())}>Try a sample trip</button>
          </div>
        )}
      </aside>

      <main className="group-pane">
        {active
          ? <Group key={active.id} group={active} onChange={updateGroup} onBack={() => setActiveId(null)} onDelete={() => deleteGroup(active.id)} />
          : <div className="placeholder"><p>Pick a group to see who owes whom.</p></div>}
      </main>

      <Sheet open={creating} onClose={() => setCreating(false)} title="New group">
        <NewGroup onCreate={addGroup} />
      </Sheet>
    </div>
  )
}

function GroupRow({ group, on, onOpen }) {
  const bal = balances(group.members, group.expenses)
  const mine = group.me ? bal[group.me] : null
  return (
    <li>
      <button className={`row group-row ${on ? 'on' : ''}`} onClick={onOpen}>
        <AvatarStack names={group.members} />
        <span className="grow">
          <strong>{group.name}</strong>
          <span className="sub">{group.members.length} people</span>
        </span>
        {mine !== null && <Standing cents={mine} currency={group.currency} compact />}
      </button>
    </li>
  )
}

function Standing({ cents, currency, compact }) {
  if (!cents) return <span className="standing even">{compact ? 'settled' : 'You’re all settled'}</span>
  const owes = cents < 0
  return (
    <span className={`standing ${owes ? 'neg' : 'pos'}`}>
      <small>{owes ? 'you owe' : 'you get back'}</small>
      {money(Math.abs(cents), currency)}
    </span>
  )
}

function Group({ group, onChange, onBack, onDelete }) {
  const [tab, setTab] = useState('expenses')
  const [adding, setAdding] = useState(false)
  const bal = balances(group.members, group.expenses)
  const plan = settle(bal)
  const fmt = (c) => money(c, group.currency)
  const real = group.expenses.filter((e) => e.category !== 'settlement')
  const total = real.reduce((s, e) => s + e.amount, 0)

  const addExpense = (e) => onChange({ ...group, expenses: [e, ...group.expenses] })
  const removeExpense = (id) => onChange({ ...group, expenses: group.expenses.filter((e) => e.id !== id) })
  const markPaid = (p) => addExpense({
    id: uid(), description: `${p.from} paid ${p.to}`, amount: p.amount, paidBy: p.from,
    splitAmong: [p.to], category: 'settlement', date: today(),
  })

  const tabs = [['expenses', 'Expenses'], ['balances', 'Balances'], ['settle', 'Settle up'], ['summary', 'Summary']]

  return (
    <div className="group">
      <header className="group-head">
        <button className="back" onClick={onBack}><Icon name="back" />Groups</button>
        <div className="title-row">
          <h2>{group.name}</h2>
          <AvatarStack names={group.members} />
        </div>
        {group.me
          ? <div className="hero-standing"><Standing cents={bal[group.me]} currency={group.currency} /></div>
          : <WhoAmI group={group} onPick={(me) => onChange({ ...group, me })} />}
        <p className="sub">
          Total {fmt(total)}{plan.length ? ` · ${plan.length} payment${plan.length > 1 ? 's' : ''} to settle` : ''}
        </p>
        <div className="segmented" role="tablist" aria-label="Group sections">
          {tabs.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>
      </header>

      <div className="tab-body" role="tabpanel">
        {tab === 'expenses' && <Expenses group={group} fmt={fmt} onRemove={removeExpense} onAdd={() => setAdding(true)} />}
        {tab === 'balances' && <Balances group={group} bal={bal} fmt={fmt} />}
        {tab === 'settle' && <Settle group={group} plan={plan} fmt={fmt} onPaid={markPaid} onUndo={removeExpense} />}
        {tab === 'summary' && <Summary group={group} bal={bal} plan={plan} fmt={fmt} total={total} real={real} onDelete={onDelete} />}
      </div>

      <button className="fab" onClick={() => setAdding(true)} aria-label="Add expense"><Icon name="plus" size={26} /></button>
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add expense">
        <ExpenseForm group={group} onAdd={(e) => { addExpense(e); setAdding(false); setTab('expenses') }} />
      </Sheet>
    </div>
  )
}

function WhoAmI({ group, onPick }) {
  return (
    <div className="who-am-i">
      <span>Which one is you?</span>
      <div className="chips">
        {group.members.map((m) => <button key={m} className="chip" onClick={() => onPick(m)}>{m}</button>)}
      </div>
    </div>
  )
}

function Expenses({ group, fmt, onRemove, onAdd }) {
  if (!group.expenses.length) {
    return (
      <div className="empty">
        <span className="empty-icon"><Icon name="bills" size={28} /></span>
        <h2>No expenses yet</h2>
        <p>Add the first bill, like train tickets or tonight's dinner.</p>
        <button className="btn" onClick={onAdd}>Add expense</button>
      </div>
    )
  }
  const days = [...new Set(group.expenses.map((e) => e.date))].sort().reverse()
  return days.map((d) => (
    <section key={d}>
      <h3 className="section-label">{dayLabel(d)}</h3>
      <ul className="list grouped">
        {group.expenses.filter((e) => e.date === d).map((e) => (
          <li key={e.id} className="row expense">
            <span className="cat" data-cat={e.category}><Icon name={e.category} /></span>
            <span className="grow">
              <strong>{e.description}</strong>
              <span className="sub">
                {e.category === 'settlement' ? 'Settlement' : `${e.paidBy === group.me ? 'You' : e.paidBy} paid ${fmt(e.amount)}`}
                {e.splitAmong.length < group.members.length && e.category !== 'settlement' && <> · <span className="nw">split {e.splitAmong.length} ways</span></>}
                {e.original && ` · ${e.original}`}
              </span>
            </span>
            <YourPart e={e} me={group.me} fmt={fmt} />
            <button className="icon-btn muted" aria-label={`Delete ${e.description}`} onClick={() => onRemove(e.id)}><Icon name="trash" size={18} /></button>
          </li>
        ))}
      </ul>
    </section>
  ))
}

// Splitwise-style: what this expense means for "me"
function YourPart({ e, me, fmt }) {
  if (e.category === 'settlement' || !me) return <span className="amount">{fmt(e.amount)}</span>
  const share = e.splitAmong.includes(me) ? Math.round(e.amount / e.splitAmong.length) : 0
  if (e.paidBy === me) return <span className="amount pos"><small>you lent</small>{fmt(e.amount - share)}</span>
  if (share) return <span className="amount neg"><small>you owe</small>{fmt(share)}</span>
  return <span className="amount muted"><small>not involved</small></span>
}

function Balances({ group, bal, fmt }) {
  return (
    <ul className="list grouped">
      {group.members.map((m) => (
        <li key={m} className="row">
          <Avatar name={m} tone={group.members.indexOf(m)} />
          <span className="grow"><strong>{m}{m === group.me && <span className="you-tag">You</span>}</strong></span>
          <span className={`amount ${bal[m] > 0 ? 'pos' : bal[m] < 0 ? 'neg' : 'muted'}`}>
            <small>{bal[m] > 0 ? 'gets back' : bal[m] < 0 ? 'owes' : 'settled'}</small>
            {bal[m] ? fmt(Math.abs(bal[m])) : ''}
          </span>
        </li>
      ))}
      <li className="row checksum">
        <span className="cat" data-cat="settlement"><Icon name="check" /></span>
        <span className="grow"><strong>Balances add up to {fmt(Object.values(bal).reduce((a, b) => a + b, 0))}</strong>
          <span className="sub">Every rupee owed is a rupee someone gets back.</span></span>
      </li>
    </ul>
  )
}

function Settle({ group, plan, fmt, onPaid, onUndo }) {
  const [paying, setPaying] = useState(null)
  const paid = group.expenses.filter((e) => e.category === 'settlement')
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

  const pay = (p) => {
    setPaying(p.from + p.to)
    setTimeout(() => { onPaid(p); setPaying(null) }, reduce ? 150 : 1100)
  }
  const name = (n) => (n === group.me ? 'You' : n)

  return (
    <>
      {plan.length ? (
        <>
          <div className="settle-hero">
            <strong><span className="num">{plan.length}</span> payment{plan.length === 1 ? '' : 's'}</strong>
            <span>settle{plan.length === 1 ? 's' : ''} everything in {group.name}</span>
          </div>
          <ul className="list grouped">
            {plan.map((p) => {
              const busy = paying === p.from + p.to
              return (
                <li key={p.from + p.to} className={`row settle ${busy ? 'busy' : ''}`}>
                  <span className="pair"><Avatar name={p.from} tone={group.members.indexOf(p.from)} /><span className="arrow"><Icon name="arrow" size={16} /></span><Avatar name={p.to} tone={group.members.indexOf(p.to)} /></span>
                  <span className="grow">
                    <strong>{name(p.from)} {p.from === group.me ? 'pay' : 'pays'} {name(p.to)}</strong>
                    <span className="amount-lg">{fmt(p.amount)}</span>
                  </span>
                  {busy
                    ? <SuccessTick />
                    : <button className="btn small" disabled={!!paying} onClick={() => pay(p)}>Mark paid</button>}
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <div className="empty">
          <span className="empty-icon done"><Icon name="check" size={30} /></span>
          <h2>All settled up</h2>
          <p>Nobody owes anybody in {group.name}.</p>
        </div>
      )}

      {paid.length > 0 && (
        <section>
          <h3 className="section-label">Paid</h3>
          <ul className="list grouped">
            {paid.map((e) => (
              <li key={e.id} className="row paid">
                <span className="cat" data-cat="settlement"><Icon name="settlement" /></span>
                <span className="grow"><strong>{name(e.paidBy)} paid {name(e.splitAmong[0])}</strong><span className="sub">{dayLabel(e.date)}</span></span>
                <span className="amount">{fmt(e.amount)}</span>
                <button className="btn small ghost" onClick={() => onUndo(e.id)}>Undo</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function SuccessTick() {
  return (
    <span className="tick" role="status" aria-label="Payment recorded">
      <svg viewBox="0 0 52 52" width="40" height="40" aria-hidden="true">
        <circle cx="26" cy="26" r="24" />
        <path d="M15 27l7 7 15-16" />
      </svg>
    </span>
  )
}

function Summary({ group, bal, plan, fmt, total, real, onDelete }) {
  const [copied, setCopied] = useState(false)
  const byCat = Object.keys(CATEGORIES)
    .map((k) => [k, real.filter((e) => e.category === k).reduce((s, e) => s + e.amount, 0)])
    .filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  const myShare = group.me ? real.reduce((s, e) => s + (e.splitAmong.includes(group.me) ? Math.round(e.amount / e.splitAmong.length) : 0), 0) : null

  const text = [
    `FairSplit summary: ${group.name}`,
    `Total spent: ${fmt(total)}`,
    '', 'Balances:',
    ...group.members.map((m) => `  ${m}: ${bal[m] >= 0 ? '+' : '-'}${fmt(Math.abs(bal[m]))}`),
    '', 'To settle:',
    ...(plan.length ? plan.map((p) => `  ${p.from} pays ${p.to} ${fmt(p.amount)}`) : ['  All settled!']),
  ].join('\n')

  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true); setTimeout(() => setCopied(false), 1600)
  }
  const download = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    a.download = `${group.name.replace(/[^\w]+/g, '-')}-summary.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <>
      <ul className="list grouped facts">
        <li className="row"><span className="grow">Total spent</span><span className="amount">{fmt(total)}</span></li>
        {myShare !== null && <li className="row"><span className="grow">Your share</span><span className="amount">{fmt(myShare)}</span></li>}
        <li className="row"><span className="grow">Expenses</span><span className="amount">{real.length}</span></li>
      </ul>

      <h3 className="section-label">Where the money went</h3>
      <ul className="list grouped">
        {byCat.length ? byCat.map(([k, v]) => (
          <li key={k} className="row cat-row">
            <span className="cat" data-cat={k}><Icon name={k} /></span>
            <span className="grow">
              <strong>{CATEGORIES[k]}</strong>
              <span className="meter" data-cat={k}><span style={{ width: `${(v / total) * 100}%` }} /></span>
            </span>
            <span className="amount">{fmt(v)}<small>{Math.round((v / total) * 100)}%</small></span>
          </li>
        )) : <li className="row"><span className="sub">Nothing spent yet.</span></li>}
      </ul>

      <h3 className="section-label">Share with the group</h3>
      <div className="share">
        <pre>{text}</pre>
        <div className="actions">
          <button className="btn" onClick={copy}><Icon name={copied ? 'check' : 'copy'} size={18} />{copied ? 'Copied' : 'Copy for WhatsApp'}</button>
          <button className="btn ghost" onClick={download}><Icon name="download" size={18} />Download .txt</button>
        </div>
      </div>

      <button className="btn danger-link" onClick={onDelete}><Icon name="trash" size={18} />Delete group</button>
    </>
  )
}

function Sheet({ open, onClose, title, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const d = ref.current
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className="sheet" aria-label={title} onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose() }}>
      <div className="sheet-inner">
        <header className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </header>
        {open && children}
      </div>
    </dialog>
  )
}

function NewGroup({ onCreate }) {
  const [name, setName] = useState('')
  const [people, setPeople] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [me, setMe] = useState('')
  const [err, setErr] = useState('')
  const members = [...new Set(people.split(',').map((s) => s.trim()).filter(Boolean))]

  const submit = (e) => {
    e.preventDefault()
    if (!name.trim()) return setErr('Give the group a name.')
    if (members.length < 2) return setErr('Add at least 2 people, separated by commas.')
    onCreate({ id: uid(), name: name.trim(), currency, members, me: members.includes(me) ? me : undefined, expenses: [] })
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="field"><span>Group name</span>
        <input autoFocus placeholder="Room 204, Goa Trip…" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field"><span>People</span>
        <input placeholder="Asha, Ravi, Meera" value={people} onChange={(e) => setPeople(e.target.value)} /></label>
      {members.length > 0 && (
        <div className="field"><span>Which one is you?</span>
          <div className="chips">
            {members.map((m) => <button type="button" key={m} className={`chip ${me === m ? 'on' : ''}`} aria-pressed={me === m} onClick={() => setMe(m)}>{m}</button>)}
          </div>
        </div>
      )}
      <label className="field"><span>Currency</span>
        <select value={currency} onChange={(e) => setCurrency(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn block">Create group</button>
    </form>
  )
}

function ExpenseForm({ group, onAdd }) {
  const [f, setF] = useState({ description: '', amount: '', currency: group.currency, category: 'food', paidBy: group.me || group.members[0], splitAmong: group.members })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const toggle = (m) => setF({ ...f, splitAmong: f.splitAmong.includes(m) ? f.splitAmong.filter((x) => x !== m) : [...f.splitAmong, m] })
  const amt = Number(f.amount)
  const each = amt > 0 && f.splitAmong.length ? money(Math.round(toCents(amt) / f.splitAmong.length), f.currency) : null

  const submit = async (e) => {
    e.preventDefault()
    if (!f.description.trim()) return setErr('What was it for?')
    if (!(amt > 0)) return setErr('Enter an amount more than 0.')
    if (!f.splitAmong.length) return setErr('Pick at least one person to split with.')
    setBusy(true); setErr('')
    try {
      const r = await rate(f.currency, group.currency)
      onAdd({
        id: uid(), description: f.description.trim(), amount: toCents(amt * r), paidBy: f.paidBy,
        splitAmong: group.members.filter((m) => f.splitAmong.includes(m)), category: f.category, date: today(),
        original: f.currency !== group.currency ? `${amt} ${f.currency} @ ${r}` : undefined,
      })
    } catch (ex) { setErr(ex.message); setBusy(false) }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="amount-entry">
        <select value={f.currency} onChange={set('currency')} aria-label="Currency">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
        <input autoFocus type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" aria-label="Amount" value={f.amount} onChange={set('amount')} />
      </div>
      <p className="live-split" aria-live="polite">
        {each ? `${each} each · ${f.splitAmong.length} ${f.splitAmong.length === 1 ? 'person' : 'people'}` : 'Type an amount to see each share'}
      </p>
      <label className="field"><span>What for</span>
        <input placeholder="Pizza night" value={f.description} onChange={set('description')} /></label>

      <div className="field"><span>Category</span>
        <div className="chips">
          {Object.entries(CATEGORIES).map(([k, v]) => (
            <button type="button" key={k} className={`chip cat-chip ${f.category === k ? 'on' : ''}`} aria-pressed={f.category === k} onClick={() => setF({ ...f, category: k })}>
              <Icon name={k} size={16} />{v}
            </button>
          ))}
        </div>
      </div>
      <div className="field"><span>Paid by</span>
        <div className="chips">
          {group.members.map((m) => (
            <button type="button" key={m} className={`chip ${f.paidBy === m ? 'on' : ''}`} aria-pressed={f.paidBy === m} onClick={() => setF({ ...f, paidBy: m })}>
              {m === group.me ? 'You' : m}
            </button>
          ))}
        </div>
      </div>
      <div className="field"><span>Split between</span>
        <div className="chips">
          {group.members.map((m) => (
            <button type="button" key={m} className={`chip ${f.splitAmong.includes(m) ? 'on' : ''}`} aria-pressed={f.splitAmong.includes(m)} onClick={() => toggle(m)}>
              {m === group.me ? 'You' : m}
            </button>
          ))}
        </div>
      </div>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn block" disabled={busy}>{busy ? 'Converting…' : 'Add expense'}</button>
    </form>
  )
}
