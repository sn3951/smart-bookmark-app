"use client";

import { useState, FormEvent, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Bookmark } from "@/types";

interface AddBookmarkFormProps {
  userId: string;
  onAdd: (bookmark: Bookmark) => void;
}

function getFavicon(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch {
    return "";
  }
}

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function AddBookmarkForm({ userId, onAdd }: AddBookmarkFormProps) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedUrl = url.trim();
    const trimmedTitle = title.trim();

    if (!trimmedUrl) {
      setError("Please enter a URL.");
      return;
    }

    const finalUrl =
      trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")
        ? trimmedUrl
        : `https://${trimmedUrl}`;

    if (!isValidUrl(finalUrl)) {
      setError("Please enter a valid URL.");
      return;
    }

    if (!trimmedTitle) {
      setError("Please enter a title.");
      return;
    }

    setLoading(true);

    const { data, error: insertError } = await supabase
      .from("bookmarks")
      .insert({
        user_id: userId,
        url: finalUrl,
        title: trimmedTitle,
        favicon: getFavicon(finalUrl),
      })
      .select()
      .single();

    setLoading(false);

    if (insertError || !data) {
      setError("Failed to save bookmark. Please try again.");
      return;
    }

    // Immediately update the UI on this page via the callback
    // The realtime event will handle OTHER open tabs
    onAdd(data as Bookmark);

    setUrl("");
    setTitle("");
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface border border-border rounded-2xl p-5"
    >
      <p className="font-semibold text-sm mb-4 text-muted uppercase tracking-widest font-mono">
        Add Bookmark
      </p>

      <div className="space-y-3">
        <div>
          <input
            type="text"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(""); }}
            className="w-full px-4 py-3 bg-paper border border-border rounded-xl font-mono text-sm placeholder:text-muted/60 focus:border-ink transition-colors"
            disabled={loading}
          />
        </div>

        <div>
          <input
            type="text"
            placeholder="Title (e.g. My Favorite Article)"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setError(""); }}
            className="w-full px-4 py-3 bg-paper border border-border rounded-xl text-sm placeholder:text-muted/60 focus:border-ink transition-colors"
            disabled={loading}
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 font-mono">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || success}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-150 active:scale-[0.99] ${
            success
              ? "bg-green-500 text-white"
              : "bg-accent text-white hover:bg-accent/90"
          } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </span>
          ) : success ? "✓ Saved!" : "Save Bookmark →"}
        </button>
      </div>
    </form>
  );
}