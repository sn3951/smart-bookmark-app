# Markd — Smart Bookmark Manager

> A real-time, privacy-first bookmark manager built with Next.js 15, Supabase, and Tailwind CSS.

🔗 **Live URL**: [your-vercel-url.vercel.app](https://your-vercel-url.vercel.app)  
📦 **Repo**: [github.com/yourusername/smart-bookmark-app](https://github.com/yourusername/smart-bookmark-app)

---

## Features

- 🔐 **Google OAuth only** — No email/password. Sign in with Google in one click.
- 🔖 **Add bookmarks** — Save any URL with a custom title instantly.
- 🔒 **Private by default** — Row Level Security ensures users can only see their own bookmarks.
- ⚡ **Real-time sync** — Open two tabs; add a bookmark in one and it appears in the other within milliseconds via Supabase Realtime.
- 🗑️ **Delete anytime** — Remove bookmarks with an optimistic UI update (instant feedback).
- 🚀 **Deployed on Vercel** — Zero-config deployment with automatic HTTPS.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Auth | Supabase Auth (Google OAuth) |
| Database | Supabase (PostgreSQL) |
| Realtime | Supabase Realtime (Postgres Changes) |
| Styling | Tailwind CSS |
| Deployment | Vercel |

---

## Architecture

```
src/
├── app/
│   ├── layout.tsx           # Root layout with fonts
│   ├── page.tsx             # Landing / Login page (Server Component)
│   ├── globals.css          # Global styles + animations
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts     # OAuth callback handler
│   └── dashboard/
│       └── page.tsx         # Dashboard (Server Component, fetches initial data)
├── components/
│   ├── LoginButton.tsx      # Google OAuth trigger
│   ├── DashboardClient.tsx  # Main dashboard with Realtime subscription
│   ├── AddBookmarkForm.tsx  # Form with validation + optimistic UI
│   ├── BookmarkCard.tsx     # Individual bookmark with delete
│   └── UserMenu.tsx         # Dropdown with sign-out
├── lib/
│   └── supabase/
│       ├── client.ts        # Browser Supabase client
│       └── server.ts        # Server Supabase client
├── types/
│   └── index.ts             # TypeScript interfaces
└── middleware.ts             # Route protection + session refresh
```

**Key design decisions:**
- **Server Components for initial data load**: The dashboard page fetches bookmarks server-side so there's no loading flicker on first visit.
- **Client Component for realtime**: `DashboardClient` subscribes to Postgres changes and updates state in real-time.
- **Optimistic deletes**: Bookmarks are removed from UI immediately; reverted if the server call fails.

---

## Local Development

### Prerequisites
- Node.js 18+
- A Supabase project
- A Google OAuth application

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/smart-bookmark-app.git
cd smart-bookmark-app
npm install
```

### 2. Set Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase-schema.sql`
3. Go to **Authentication > Providers** and enable Google
4. Add your Google OAuth credentials (Client ID + Secret)
5. Add `http://localhost:3000/auth/callback` to the allowed redirect URLs

### 3. Configure Environment Variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deployment (Vercel)

1. Push repo to GitHub
2. Import project in [vercel.com](https://vercel.com)
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` = your Vercel URL (e.g. `https://markd.vercel.app`)
4. In Supabase: add your Vercel URL to **Authentication > URL Configuration > Redirect URLs**
5. Deploy!

---

## Problems I Ran Into & How I Solved Them

### 1. Realtime not firing in production
**Problem**: The Supabase Realtime subscription was set up correctly locally but wasn't triggering in production. Bookmarks added in one tab weren't appearing in another.

**Root cause**: The `bookmarks` table wasn't added to Supabase's realtime publication. By default, new tables aren't included.

**Solution**: Added `ALTER PUBLICATION supabase_realtime ADD TABLE public.bookmarks;` to the schema SQL. This is now documented in `supabase-schema.sql`.

---

### 2. Duplicate bookmarks on realtime insert
**Problem**: When I added a bookmark, it would appear twice — once from the optimistic/server response and once from the realtime INSERT event.

**Root cause**: The server-side insert returns the new row, and simultaneously the realtime channel also fires an INSERT event for the same row.

**Solution**: Added a deduplication check in the realtime INSERT handler:
```ts
setBookmarks((prev) => {
  if (prev.some((b) => b.id === payload.new.id)) return prev; // skip duplicate
  return [payload.new as Bookmark, ...prev];
});
```

---

### 3. Next.js cookies() async API change
**Problem**: Next.js 15 made `cookies()` async, which broke the Supabase server client helper that was calling it synchronously.

**Root cause**: Next.js 15 App Router requires `await cookies()`.

**Solution**: Updated `server.ts` to `const cookieStore = await cookies()` and made the function `async`.

---

### 4. Google OAuth redirect URL mismatch
**Problem**: After deploying to Vercel, Google OAuth was returning a `redirect_uri_mismatch` error.

**Root cause**: I only added `localhost:3000/auth/callback` to Supabase's allowed redirect URLs, not the production Vercel URL.

**Solution**: Added the production URL (`https://markd.vercel.app/auth/callback`) in both:
- Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
- Google Cloud Console → OAuth 2.0 credentials → Authorized redirect URIs

---

### 5. Row Level Security blocking all inserts
**Problem**: Bookmarks were being inserted but immediately disappearing. The database showed them but the SELECT was returning nothing.

**Root cause**: RLS was enabled but the SELECT policy wasn't created yet — so users could insert but couldn't read back their own data.

**Solution**: Explicitly created all three RLS policies (SELECT, INSERT, DELETE) scoped to `auth.uid() = user_id` before enabling RLS.

---

## Security

- **Row Level Security (RLS)** is enabled on the `bookmarks` table. Every query is scoped to `auth.uid() = user_id` — users can never access each other's data, even with a valid session token.
- **Google OAuth only** eliminates password storage and credential stuffing risks entirely.
- The Supabase **anon key** is safe to expose publicly — it only works within the bounds of RLS policies.

---

## What I'd Add Next

- [ ] Search/filter bookmarks
- [ ] Folder/tag organization
- [ ] Browser extension for one-click saving
- [ ] Drag-to-reorder
- [ ] Auto-fetch page title on URL paste
- [ ] Import/export as CSV or Netscape bookmarks

---

*Built in 72 hours for a take-home assignment.*
