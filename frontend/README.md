# Udyam Disha

Rural business feasibility and loan-readiness advisory tool. Given a state,
district, block, village, business category and investment amount, it calls
the backend API for local market metrics, a SWOT-style advisory, applicable
government schemes, and a financial roadmap (sanctioned scheme, loan amount,
and a quarterly EMI repayment schedule).

## Stack

- [TanStack Start](https://tanstack.com/start) (file-based routing in `src/routes/`)
- React 19 + Tailwind v4 + shadcn/ui components (`src/components/ui/`)
- Backend API base URL is set in `src/lib/api.ts`

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
