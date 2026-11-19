This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Backend API

The frontend proxies API calls through `/api/backend` to avoid browser CORS
requirements. The NestJS backend defaults to port `3000`; Next.js development
uses port `3001` so the two servers cannot accidentally claim the same port.
If the backend uses another address, set `XFILE_BACKEND_URL` before starting
Next.js:

```powershell
# In the frontend terminal
$env:XFILE_BACKEND_URL = "http://localhost:3000"
npm run dev
```

Start the backend in a separate terminal with `npm run start:dev`. Open the
frontend URL printed by Next.js (normally `http://localhost:3001`).

Authenticated uploads are limited by the backend to 500 MB. Guest uploads use
the backend guest endpoint, which currently allows 50 MB and expires after 24
hours.

The backend supports registration and password-reset OTP verification, login,
profile and password updates, link creation and deletion, and link expiry by
time or download count. Team APIs support team/member management, sharing and
removing links, role changes, ownership transfer, QR generation, and download
by QR. Editing an existing link's security settings is not supported.

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

Open the URL printed by Next.js.

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
