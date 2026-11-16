This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Backend API

The frontend proxies API calls through `/api/backend` to avoid browser CORS
requirements. Start the NestJS backend, then set `XFILE_BACKEND_URL` before
starting Next.js if the backend is not at `http://localhost:3000`:

```powershell
$env:XFILE_BACKEND_URL = "http://localhost:3000"
npm run dev
```

Authenticated uploads are limited by the backend to 500 MB. Guest uploads use
the backend guest endpoint, which currently allows 50 MB and expires after 24
hours.

The backend currently supports registration OTP verification, login, profile
updates, password changes for signed-in users, link creation and deletion, and
link expiry by time or download count. It does not expose forgot-password,
resend-OTP, team-management, or update-existing-link endpoints.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open the URL printed by Next.js. If the backend already uses port 3000, Next.js
will usually start on port 3001.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
