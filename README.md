# Markd — Smart Bookmark Manager

> A real-time, privacy-first bookmark manager built with Next.js 15, Supabase, and Tailwind CSS.

🔗 **Live URL**: [smart-bookmark-app-abstrabit.vercel.app](https://smart-bookmark-app-abstrabit.vercel.app/)  
📦 **Repo**: [github.com/sn3951/smart-bookmark-app](https://github.com/sn3951/smart-bookmark-app)

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

# Markd — Debugging Log

A record of the real-time sync and auth bugs I ran into while building this app, and exactly how I fixed them.

---

## The App

**Markd** is a bookmark manager built with Next.js 14, Supabase (Auth + Postgres + Realtime), and Tailwind CSS. The core promise is real-time sync — add or delete a bookmark in one tab and it instantly reflects in every other open tab.

---

## Bug 1 — Login / Logout not syncing across tabs on first load

### What was happening

When a user opened two tabs and logged in on one, the other tab stayed on the login page. Similarly, signing out on one tab left the other stuck on the dashboard. Only a manual refresh would sync the state.

### Root cause

The `AuthListener` component was listening to `onAuthStateChange` and pushing to the correct route, but `UserMenu.handleSignOut` was also calling `router.push("/")` and `router.refresh()` immediately after `supabase.auth.signOut()`. These two navigations raced against each other — the manual push would fire before the auth state change propagated, leaving the current tab stuck mid-redirect.

### The fix

**`UserMenu.tsx`** — Removed all manual navigation from `handleSignOut`. Now it only calls `supabase.auth.signOut()` and lets `DashboardClient`'s `onAuthStateChange` listener be the single source of truth for redirecting. This listener fires on every tab, so both the current tab and all other open tabs navigate correctly.

```ts
// Before — races with onAuthStateChange
const handleSignOut = async () => {
  setSigningOut(true);
  await supabase.auth.signOut();
  router.push("/");   // ← This raced with the listener
  router.refresh();   // ← And this made it worse
};

// After — let onAuthStateChange handle navigation
const handleSignOut = async () => {
  setSigningOut(true);
  const { error } = await supabase.auth.signOut();
  if (error) {
    setSigningOut(false); // Reset on failure so user can retry
  }
  // onAuthStateChange fires SIGNED_OUT → router.push("/") in DashboardClient
};
```

---

## Bug 2 — Realtime channel rebuilding on every bookmark add

### What was happening

After fixing login/logout, live sync was still broken. Adding a bookmark updated the current tab immediately (via optimistic update) but the other tab only reflected it after a manual refresh.

### Root cause

In `DashboardClient`, the `fetchBookmarks` callback was listed as a dependency of the `useEffect` that set up the Supabase realtime channel:

```ts
useEffect(() => {
  const channel = supabase.channel(...)
    .on("postgres_changes", { event: "INSERT" }, () => {
      fetchBookmarks(); // ← fetchBookmarks in the closure
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [supabase, user.id, fetchBookmarks]); // ← fetchBookmarks here caused the problem
```

Every time a bookmark was added, `fetchBookmarks` ran → updated state → recreated the `useCallback` reference → triggered this `useEffect` to re-run → **tore down and rebuilt the entire Supabase channel**. The channel was constantly being recycled, so it never stayed subscribed long enough to receive events.

### The fix

Used the **ref pattern** to keep `fetchBookmarks` stable without it being a `useEffect` dependency. The channel setup effect now only depends on `[supabase, user.id]` and is never torn down unnecessarily.

```ts
const fetchBookmarksRef = useRef(fetchBookmarks);
useEffect(() => {
  fetchBookmarksRef.current = fetchBookmarks;
}, [fetchBookmarks]);

useEffect(() => {
  const channel = supabase.channel(`bookmarks-${user.id}`)
    .on("postgres_changes", { event: "INSERT" }, () => {
      fetchBookmarksRef.current(); // ← ref, not the value itself
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [supabase, user.id]); // ← fetchBookmarks no longer here
```

---

## Bug 3 — Server-side filter on `postgres_changes` silently dropping all events

### What was happening

After fixing the channel rebuild loop, DELETE sync started working but INSERT still didn't reflect in the other tab live.

### Root cause

I had added a server-side filter to the `postgres_changes` subscription to scope events to the current user:

```ts
.on("postgres_changes", {
  event: "INSERT",
  schema: "public",
  table: "bookmarks",
  filter: `user_id=eq.${user.id}`, // ← This was the problem
}, () => { ... })
```

**Supabase strips all row data from `postgres_changes` payloads when RLS (Row Level Security) is enabled.** The payload arrives as `payload.new = {}`. When you also add a `filter`, Supabase tries to evaluate `user_id=eq.<id>` against that empty object — it can't match — so **the event is silently dropped and the callback never fires at all.**

This affected both INSERT and DELETE events.

### The fix

Removed the `filter` from both `postgres_changes` listeners entirely. Since `fetchBookmarks` already contains `.eq("user_id", user.id)`, it only ever fetches the current user's bookmarks regardless of what triggered the refetch.

```ts
// Before — filter silently killed events with RLS
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

## Bug 4 — INSERT still not syncing after all of the above

### What was happening

DELETE was now working perfectly in real-time across tabs. But adding a bookmark still only appeared in the tab that submitted the form.

### Root cause

This was the deepest bug. With RLS enabled, Supabase `postgres_changes` delivers `payload.new = {}` for every INSERT — the actual row data is stripped. The callback fires, `fetchBookmarks()` runs on the listening tab, but the fetch returns the new bookmark... and the other tab's state updates correctly in theory. 

In practice, the issue was that `postgres_changes` for INSERT events with empty payloads and no filter is **unreliable** — Supabase's realtime infrastructure cannot guarantee delivery when it has no row data to route the event. The events were simply not reaching the other tab.

### The fix

Switched INSERT sync to use **Supabase Broadcast** instead of `postgres_changes`. Broadcast is a pure pub/sub mechanism that doesn't involve database row data at all — it bypasses RLS entirely because it's just a message passing system.

**`AddBookmarkForm.tsx`** — After a successful insert, broadcast the new bookmark to all subscribers on the same channel:

```ts
const { data } = await supabase
  .from("bookmarks")
  .insert({ ... })
  .select()
  .single();

// 1. Instant update on THIS tab
onAdd(data as Bookmark);

// 2. Broadcast to ALL other tabs — bypasses RLS payload issue entirely
await supabase.channel(`bookmarks-${userId}`).send({
  type: "broadcast",
  event: "bookmark-added",
  payload: data,
});
```

**`DashboardClient.tsx`** — Listen for the broadcast event and update state, deduplicating by `id` so the sending tab doesn't add the bookmark twice:

```ts
.on("broadcast", { event: "bookmark-added" }, (payload) => {
  const newBookmark = payload.payload as Bookmark;
  setBookmarks((prev) => {
    if (prev.some((b) => b.id === newBookmark.id)) return prev; // dedupe
    return [newBookmark, ...prev];
  });
})
```

DELETE continues to use `postgres_changes` + `fetchBookmarks` since it works reliably (the DELETE event fires even with an empty payload, and a refetch is sufficient to remove the item).

---

## Summary

| Bug | Cause | Fix |
|-----|-------|-----|
| Login/logout not syncing | `UserMenu` manually navigating in race with `onAuthStateChange` | Removed manual `router.push` from `UserMenu`, let `onAuthStateChange` be sole navigator |
| Channel rebuilding constantly | `fetchBookmarks` in `useEffect` deps caused channel teardown on every fetch | Ref pattern — `fetchBookmarksRef` keeps callback stable outside deps |
| Events silently dropped | `postgres_changes` `filter` can't evaluate against empty RLS payloads | Removed all `filter` options from `postgres_changes` listeners |
| INSERT not syncing cross-tab | `postgres_changes` INSERT delivery unreliable with RLS empty payloads | Switched INSERT to Supabase Broadcast — full payload, no RLS interference |

---

## Key Takeaway

**Supabase Realtime + RLS = empty payloads.** When RLS is enabled on a table, `postgres_changes` strips all row data from event payloads. This has two consequences:

1. Server-side `filter` options on the subscription **silently stop all events** because the filter can't be evaluated
2. `payload.new` and `payload.old` are always `{}`, so you can never read the inserted/deleted row from the event itself

The workaround is:
- For **INSERT**: use Broadcast to send the data yourself after the insert
- For **DELETE**: use `postgres_changes` without a filter, then refetch (the event fires reliably even with an empty payload)
- Always scope your data fetches by `user_id` in the query itself, not via channel filters

---

*Built with Next.js · Supabase · Tailwind CSS*
