# Markd — Smart Bookmark Manager

A real-time, privacy-first bookmark manager built with Next.js 16, Supabase, and Tailwind CSS.

🔗 **Live:** [smart-bookmark-app-abstrabit.vercel.app](https://smart-bookmark-app-abstrabit.vercel.app)
📦 **Repo:** [github.com/sn3951/smart-bookmark-app](https://github.com/sn3951/smart-bookmark-app)

---

## Features

- 🔐 **Google OAuth only** — No email/password. Sign in with Google in one click.
- 🔖 **Add bookmarks** — Save any URL with a custom title instantly.
- 🔒 **Private by default** — Row Level Security ensures users can only see their own bookmarks.
- ⚡ **Real-time sync** — Open two tabs; add or delete a bookmark in one and it appears in the other within milliseconds via Supabase Realtime.
- 🗑️ **Delete anytime** — Remove bookmarks with an optimistic UI update (instant feedback).
- 🚀 **Deployed on Vercel** — Zero-config deployment with automatic HTTPS.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Auth | Supabase Auth (Google OAuth) |
| Database | Supabase (PostgreSQL) |
| Realtime | Supabase Realtime (Broadcast + Postgres Changes) |
| Styling | Tailwind CSS |
| Deployment | Vercel |

---

## Architecture

```
src/
├── app/
│   ├── layout.tsx               # Root layout with fonts
│   ├── page.tsx                 # Landing / Login page (Server Component)
│   ├── globals.css              # Global styles + animations
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts         # OAuth callback handler
│   └── dashboard/
│       └── page.tsx             # Dashboard (Server Component, fetches initial data)
├── components/
│   ├── LoginButton.tsx          # Google OAuth trigger
│   ├── AuthListener.tsx         # Cross-tab login sync on landing page
│   ├── DashboardClient.tsx      # Main dashboard with Realtime subscription
│   ├── AddBookmarkForm.tsx      # Form with validation + optimistic UI + broadcast
│   ├── BookmarkCard.tsx         # Individual bookmark with delete
│   └── UserMenu.tsx             # Dropdown with sign-out
├── lib/
│   └── supabase/
│       ├── client.ts            # Browser Supabase client
│       └── server.ts            # Server Supabase client
├── types/
│   └── index.ts                 # TypeScript interfaces
└── middleware.ts                 # Route protection + session refresh
```

**Key design decisions:**

- **Server Components for initial data load** — The dashboard page fetches bookmarks server-side so there's no loading flicker on first visit.
- **Client Component for realtime** — `DashboardClient` subscribes to Supabase Realtime and updates state live.
- **Broadcast for INSERT sync** — Because Supabase strips row data from `postgres_changes` payloads when RLS is enabled, INSERT events are synced via Supabase Broadcast instead. See the debugging section below for the full explanation.
- **Optimistic deletes** — Bookmarks are removed from the UI immediately and reverted if the server call fails.

---

## Local Development

### Prerequisites

- Node.js 18+
- A Supabase project
- A Google OAuth application

### 1. Clone & Install

```bash
git clone https://github.com/sn3951/smart-bookmark-app.git
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
2. Import project at [vercel.com](https://vercel.com)
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` = your Vercel URL (e.g. `https://markd.vercel.app`)
4. In Supabase: add your Vercel URL to **Authentication > URL Configuration > Redirect URLs**
5. Deploy!

---

## Debugging Log

A record of every real-time sync and auth bug encountered while building this app, and exactly how each one was fixed.

---

### Bug 1 — OAuth callback not redirecting correctly

**What was happening**

After signing in with Google, the OAuth callback would complete but the user would land on a blank page or get stuck in a redirect loop instead of reaching the dashboard.

**Root cause**

The `NEXT_PUBLIC_SITE_URL` environment variable was not set, and the OAuth callback route was constructing the redirect URL incorrectly. Supabase's OAuth flow requires an exact match between the redirect URL used during sign-in and the URLs whitelisted in the Supabase dashboard.

**The fix**

Set `NEXT_PUBLIC_SITE_URL` explicitly in both `.env.local` and Vercel environment variables. Updated `LoginButton.tsx` to always use `window.location.origin` as the redirect base, and ensured the Supabase dashboard had the exact callback URL whitelisted:

```ts
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
  },
});
```

---

### Bug 2 — Login / Logout not syncing across tabs

**What was happening**

When a user opened two tabs and logged in on one, the other tab stayed on the login page. Signing out on one tab left the other stuck on the dashboard. Only a manual refresh would sync the state.

**Root cause**

`UserMenu.handleSignOut` was calling `router.push("/")` and `router.refresh()` immediately after `supabase.auth.signOut()`. At the same time, `DashboardClient`'s `onAuthStateChange` listener was also calling `router.push("/")` when it received the `SIGNED_OUT` event. These two navigations raced against each other, leaving the current tab stuck mid-redirect.

**The fix**

Removed all manual navigation from `UserMenu.handleSignOut`. It now only calls `supabase.auth.signOut()` and lets `DashboardClient`'s `onAuthStateChange` be the single source of truth for redirecting — which fires on every open tab automatically.

```ts
// Before — races with onAuthStateChange
const handleSignOut = async () => {
  setSigningOut(true);
  await supabase.auth.signOut();
  router.push("/");   // ← raced with the listener
  router.refresh();   // ← made it worse
};

// After — let onAuthStateChange handle navigation
const handleSignOut = async () => {
  setSigningOut(true);
  const { error } = await supabase.auth.signOut();
  if (error) {
    setSigningOut(false); // reset so the user can try again
  }
  // onAuthStateChange fires SIGNED_OUT → router.push("/") in DashboardClient
};
```

---

### Bug 3 — Realtime channel rebuilding on every bookmark add

**What was happening**

Adding a bookmark updated the current tab immediately via optimistic update, but the other tab only reflected it after a manual refresh.

**Root cause**

`fetchBookmarks` was listed as a dependency of the `useEffect` that set up the Supabase realtime channel:

```ts
useEffect(() => {
  const channel = supabase.channel(...)
    .on("postgres_changes", { event: "INSERT" }, () => {
      fetchBookmarks(); // ← in the closure
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [supabase, user.id, fetchBookmarks]); // ← fetchBookmarks here was the problem
```

Every time a bookmark was added: `fetchBookmarks` ran → updated state → recreated the `useCallback` reference → triggered this `useEffect` → **tore down and rebuilt the entire Supabase channel**. The channel was constantly being recycled so it never stayed subscribed long enough to receive events from other tabs.

**The fix**

Used the **ref pattern** to keep `fetchBookmarks` stable without making it a `useEffect` dependency:

```ts
const fetchBookmarksRef = useRef(fetchBookmarks);
useEffect(() => {
  fetchBookmarksRef.current = fetchBookmarks;
}, [fetchBookmarks]);

useEffect(() => {
  const channel = supabase.channel(`bookmarks-${user.id}`)
    .on("postgres_changes", { event: "INSERT" }, () => {
      fetchBookmarksRef.current(); // ← ref, not the value
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [supabase, user.id]); // ← fetchBookmarks no longer here
```

---

### Bug 4 — Server-side filter silently dropping all realtime events

**What was happening**

DELETE sync started working but INSERT still didn't reflect in the other tab live.

**Root cause**

A server-side filter had been added to the `postgres_changes` subscription to scope events to the current user:

```ts
.on("postgres_changes", {
  event: "INSERT",
  schema: "public",
  table: "bookmarks",
  filter: `user_id=eq.${user.id}`, // ← the problem
}, () => { ... })
```

**Supabase strips all row data from `postgres_changes` payloads when RLS is enabled.** The payload arrives as `payload.new = {}`. When a `filter` is also set, Supabase tries to evaluate `user_id=eq.<id>` against that empty object — it can't match — so **the event is silently dropped and the callback never fires at all.** This affected both INSERT and DELETE.

**The fix**

Removed the `filter` from both `postgres_changes` listeners. Since `fetchBookmarks` already contains `.eq("user_id", user.id)`, it only ever returns the current user's data regardless of what triggered the refetch.

```ts
// Before — filter silently killed all events with RLS
.on("postgres_changes", {
  event: "INSERT",
  schema: "public",
  table: "bookmarks",
  filter: `user_id=eq.${user.id}`, // ← removed
}, () => { fetchBookmarksRef.current(); })

// After — no filter, scoping handled inside fetchBookmarks
.on("postgres_changes", {
  event: "INSERT",
  schema: "public",
  table: "bookmarks",
}, () => { fetchBookmarksRef.current(); })
```

---

### Bug 5 — INSERT still not syncing across tabs after all of the above

**What was happening**

DELETE was working perfectly in real-time across tabs. But adding a bookmark still only appeared in the tab that submitted the form.

**Root cause**

With RLS enabled, Supabase `postgres_changes` always delivers `payload.new = {}` for INSERT events — the actual row data is stripped. Even without a filter, `postgres_changes` INSERT delivery with empty payloads is **unreliable** — Supabase's realtime infrastructure cannot guarantee routing an event when it has no row data to work with. The events were simply not reaching the other tab.

**The fix**

Switched INSERT sync to **Supabase Broadcast** instead of `postgres_changes`. Broadcast is a pure pub/sub mechanism — it carries whatever payload you send it and bypasses RLS entirely since it's not tied to database row data.

**`AddBookmarkForm.tsx`** — After a successful insert, broadcast the new bookmark to all subscribers on the same channel:

```ts
const { data } = await supabase
  .from("bookmarks")
  .insert({ ... })
  .select()
  .single();

// 1. Instant update on THIS tab
onAdd(data as Bookmark);

// 2. Broadcast full bookmark to ALL other tabs
await supabase.channel(`bookmarks-${userId}`).send({
  type: "broadcast",
  event: "bookmark-added",
  payload: data,
});
```

**`DashboardClient.tsx`** — Listen for the broadcast and update state, deduplicating by `id` so the sending tab doesn't add it twice:

```ts
.on("broadcast", { event: "bookmark-added" }, (payload) => {
  const newBookmark = payload.payload as Bookmark;
  setBookmarks((prev) => {
    if (prev.some((b) => b.id === newBookmark.id)) return prev;
    return [newBookmark, ...prev];
  });
})
```

DELETE continues to use `postgres_changes` + `fetchBookmarks` since DELETE events fire reliably even with an empty payload.

---

### Summary

| Bug | Cause | Fix |
|-----|-------|-----|
| OAuth callback failing | Missing `NEXT_PUBLIC_SITE_URL`, mismatched redirect URL | Set env var, use `window.location.origin`, whitelist URL in Supabase |
| Login/logout not syncing across tabs | `UserMenu` manually navigating in race with `onAuthStateChange` | Removed manual `router.push` from `UserMenu`, `onAuthStateChange` is sole navigator |
| Channel rebuilding on every fetch | `fetchBookmarks` in `useEffect` deps caused channel teardown on every add | Ref pattern — `fetchBookmarksRef` keeps callback stable outside deps |
| All realtime events silently dropped | `postgres_changes` `filter` can't evaluate against empty RLS payloads | Removed all `filter` options from `postgres_changes` listeners |
| INSERT not syncing cross-tab | `postgres_changes` INSERT unreliable with RLS empty payloads | Switched INSERT sync to Supabase Broadcast — full payload, no RLS interference |

---

### Key Takeaway

**Supabase Realtime + RLS = empty payloads.** When RLS is enabled on a table, `postgres_changes` strips all row data from event payloads. This has two consequences:

- Server-side `filter` options **silently stop all events** because the filter can't be evaluated against an empty payload
- `payload.new` and `payload.old` are always `{}`, so you can never read row data directly from the event

The pattern that works reliably:

- **INSERT** → use Supabase Broadcast to send the data yourself after the insert
- **DELETE** → use `postgres_changes` without a filter, then refetch (events fire reliably even with an empty payload)
- Always scope data fetches by `user_id` inside the query itself, never via channel filters

---

*Built with Next.js · Supabase · Tailwind CSS*
