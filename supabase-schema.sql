-- =============================================
-- Smart Bookmark App - Supabase Schema
-- Run this in your Supabase SQL Editor
-- =============================================

-- 1. Create the bookmarks table
CREATE TABLE IF NOT EXISTS public.bookmarks (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  url         TEXT NOT NULL,
  favicon     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Index for fast per-user queries
CREATE INDEX IF NOT EXISTS bookmarks_user_id_idx
  ON public.bookmarks (user_id);

CREATE INDEX IF NOT EXISTS bookmarks_created_at_idx
  ON public.bookmarks (created_at DESC);

-- 3. Enable Row Level Security
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies — users can only see/modify their own bookmarks

-- SELECT: users can only read their own bookmarks
CREATE POLICY "Users can view own bookmarks"
  ON public.bookmarks
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: users can only insert with their own user_id
CREATE POLICY "Users can insert own bookmarks"
  ON public.bookmarks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- DELETE: users can only delete their own bookmarks
CREATE POLICY "Users can delete own bookmarks"
  ON public.bookmarks
  FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Enable Realtime for the bookmarks table
-- Run this AFTER creating the table:
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookmarks;
