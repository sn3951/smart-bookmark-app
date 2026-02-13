"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Bookmark } from "@/types";
import AddBookmarkForm from "@/components/AddBookmarkForm";
import BookmarkCard from "@/components/BookmarkCard";
import UserMenu from "@/components/UserMenu";

interface DashboardClientProps {
  user: User;
  initialBookmarks: Bookmark[];
}

export default function DashboardClient({
  user,
  initialBookmarks,
}: DashboardClientProps) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialBookmarks);
  const [isConnected, setIsConnected] = useState(false);

  // useMemo ensures the supabase client is NOT recreated on every render
  // A new client on each render would kill and restart the realtime channel
  const supabase = useMemo(() => createClient(), []);

  const fetchBookmarks = useCallback(async () => {
    const { data } = await supabase
      .from("bookmarks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) setBookmarks(data);
  }, [supabase, user.id]);

  useEffect(() => {
    const channel = supabase
      .channel("bookmarks-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bookmarks",
        },
        () => {
          // With RLS enabled, payload.new arrives empty {}
          // So we refetch the full list from the DB instead
          fetchBookmarks();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "bookmarks",
        },
        (payload) => {
          // DELETE payload.old always contains the id even with RLS
          setBookmarks((prev) =>
            prev.filter((b) => b.id !== payload.old.id)
          );
        }
      )
      .subscribe((status) => {
        console.log("Realtime status:", status);
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchBookmarks]);

  const handleDelete = async (id: string) => {
    // Optimistic update — remove instantly from UI
    setBookmarks((prev) => prev.filter((b) => b.id !== id));

    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      // Revert on error
      fetchBookmarks();
    }
  };

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "User";

  const firstName = displayName.split(" ")[0];

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-paper/90 backdrop-blur-sm border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-accent rounded-sm flex items-center justify-center">
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <span className="font-bold text-lg tracking-tight">Markd</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Realtime indicator */}
            <div className="hidden sm:flex items-center gap-1.5">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  isConnected ? "bg-green-500 pulse-dot" : "bg-muted"
                }`}
              />
              <span className="font-mono text-xs text-muted">
                {isConnected ? "Live" : "Connecting..."}
              </span>
            </div>

            <UserMenu user={user} displayName={displayName} />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight mb-1">
            Hey, {firstName} 👋
          </h1>
          <p className="text-muted text-sm">
            {bookmarks.length === 0
              ? "No bookmarks yet. Add your first one below."
              : `You have ${bookmarks.length} bookmark${
                  bookmarks.length === 1 ? "" : "s"
                } saved.`}
          </p>
        </div>

        {/* Add bookmark form */}
        <AddBookmarkForm userId={user.id} />

        {/* Bookmark list */}
        <div className="mt-8">
          {bookmarks.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {bookmarks.map((bookmark) => (
                <div key={bookmark.id} className="bookmark-item">
                  <BookmarkCard
                    bookmark={bookmark}
                    onDelete={handleDelete}
                  />
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
      <p className="text-muted text-sm">
        Paste a URL above to save your first bookmark.
      </p>
    </div>
  );
}
