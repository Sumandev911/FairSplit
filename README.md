# FairSplit

Split shared expenses (trips, hostel rooms, flatmates) and settle up in the fewest payments.

**Stack:** HTML, CSS, JavaScript, React 19 (Vite), Frankfurter exchange-rate REST API, localStorage.

## Run

```bash
npm install
npm run dev     # open http://localhost:5173
npm test        # settle-up logic tests
npm run build   # production build in dist/
```

## Features

- Groups with members and a base currency
- Expenses split with everyone or a subset
- Foreign-currency expenses converted live (Frankfurter API)
- Net balances and a minimum-payments settle-up plan with "Mark paid"
- Summary: category spending, copy or download as text
- Responsive, with dark mode

## Files

- `src/App.jsx`: UI components and the API call
- `src/split.js`: balance and settle-up algorithm (integer paise)
- `src/split.test.mjs`: logic tests
