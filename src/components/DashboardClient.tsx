"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Bookmark } from "@/types";
import AddBookmarkForm from "@/components/AddBookmarkForm";
import BookmarkCard from "@/components/BookmarkCard";
import UserMenu from "@/components/UserMenu";
import { useRouter } from "next/navigation";

interface DashboardClientProps {
  user: User;
  initialBookmarks: Bookmark[];
}

export default function DashboardClient({ user, initialBookmarks }: DashboardClientProps) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialBookmarks);
  const [isConnected, setIsConnected] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  // Stable ref so realtime callbacks never go stale and never cause channel rebuilds
  const bookmarksRef = useRef<Bookmark[]>(initialBookmarks);

  // Keep ref in sync with state
  useEffect(() => {
    bookmarksRef.current = bookmarks;
  }, [bookmarks]);

  // Cross-tab logout — single source of truth for navigation on SIGNED_OUT
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.push("/");
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase, router]);

  // Stable fetchBookmarks — does NOT go into realtime useEffect deps
  const fetchBookmarks = useCallback(async () => {
    const { data } = await supabase
      .from("bookmarks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setBookmarks(data as Bookmark[]);
  }, [supabase, user.id]);

  // Use a ref so realtime handler can call fetchBookmarks without being a dep
  const fetchBookmarksRef = useRef(fetchBookmarks);
  useEffect(() => {
    fetchBookmarksRef.current = fetchBookmarks;
  }, [fetchBookmarks]);

  // Realtime subscription — deps are ONLY supabase + user.id so channel is never torn down unnecessarily
  useEffect(() => {
    const channel = supabase
      .channel(`bookmarks-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bookmarks",
          // Filter server-side so only this user's inserts trigger the event
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // payload.new may be empty with RLS — use it if available, otherwise refetch
          if (payload.new && (payload.new as Bookmark).id) {
            const newBookmark = payload.new as Bookmark;
            setBookmarks((prev) => {
              // Deduplicate: the tab that inserted it already added it via handleAdd
              if (prev.some((b) => b.id === newBookmark.id)) return prev;
              return [newBookmark, ...prev];
            });
          } else {
            // Fallback: RLS stripped the payload, refetch to get the new row
            fetchBookmarksRef.current();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "bookmarks",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.old && (payload.old as Bookmark).id) {
            setBookmarks((prev) => prev.filter((b) => b.id !== (payload.old as Bookmark).id));
          } else {
            fetchBookmarksRef.current();
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, user.id]); // ← fetchBookmarks intentionally excluded via ref pattern

  // Called immediately by AddBookmarkForm — instant optimistic update on same tab
  const handleAdd = useCallback((newBookmark: Bookmark) => {
    setBookmarks((prev) => {
      if (prev.some((b) => b.id === newBookmark.id)) return prev;
      return [newBookmark, ...prev];
    });
  }, []);

  const handleDelete = async (id: string) => {
    // Optimistic update
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    // Rollback on error
    if (error) fetchBookmarks();
  };

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "User";

  const firstName = displayName.split(" ")[0];

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="sticky top-0 z-10 bg-paper/90 backdrop-blur-sm border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-accent rounded-sm flex items-center justify-center">
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <span className="font-bold text-lg tracking-tight">Markd</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-500 pulse-dot" : "bg-muted"}`} />
              <span className="font-mono text-xs text-muted">
                {isConnected ? "Live" : "Connecting..."}
              </span>
            </div>
            <UserMenu user={user} displayName={displayName} />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight mb-1">
            Hey, {firstName} 👋
          </h1>
          <p className="text-muted text-sm">
            {bookmarks.length === 0
              ? "No bookmarks yet. Add your first one below."
              : `You have ${bookmarks.length} bookmark${bookmarks.length === 1 ? "" : "s"} saved.`}
          </p>
        </div>

        <AddBookmarkForm userId={user.id} onAdd={handleAdd} />

        <div className="mt-8">
          {bookmarks.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {bookmarks.map((bookmark) => (
                <div key={bookmark.id} className="bookmark-item">
                  <BookmarkCard bookmark={bookmark} onDelete={handleDelete} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-2 border-dashed border-border rounded-2xl p-12 text-center">
      <div className="text-4xl mb-3">🔖</div>
      <p className="font-semibold text-lg mb-1">Nothing saved yet</p>
      <p className="text-muted text-sm">Paste a URL above to save your first bookmark.</p>
    </div>
  );
}