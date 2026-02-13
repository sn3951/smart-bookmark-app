"use client";

import { useState } from "react";
import type { Bookmark } from "@/types";
import Image from "next/image";

interface BookmarkCardProps {
  bookmark: Bookmark;
  onDelete: (id: string) => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

function truncateUrl(url: string, maxLen = 50): string {
  try {
    const u = new URL(url);
    const display = u.hostname + u.pathname;
    return display.length > maxLen
      ? display.substring(0, maxLen) + "…"
      : display;
  } catch {
    return url.length > maxLen ? url.substring(0, maxLen) + "…" : url;
  }
}

export default function BookmarkCard({ bookmark, onDelete }: BookmarkCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [imgError, setImgError] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(true);
    onDelete(bookmark.id);
  };

  return (
    <div
      className={`bookmark-card group relative bg-paper border border-border rounded-2xl p-4 flex items-center gap-4 ${
        deleting ? "opacity-50 scale-[0.99]" : ""
      } transition-all duration-200`}
    >
      {/* Favicon */}
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center overflow-hidden">
        {bookmark.favicon && !imgError ? (
          <Image
            src={bookmark.favicon}
            alt=""
            width={24}
            height={24}
            className="w-6 h-6"
            onError={() => setImgError(true)}
            unoptimized
          />
        ) : (
          <span className="text-sm font-bold text-muted uppercase">
            {bookmark.title.charAt(0)}
          </span>
        )}
      </div>

      {/* Content */}
      <a
        href={bookmark.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 min-w-0"
      >
        <p className="font-semibold text-sm leading-tight truncate group-hover:text-accent transition-colors">
          {bookmark.title}
        </p>
        <p className="text-muted font-mono text-xs mt-0.5 truncate">
          {truncateUrl(bookmark.url)}
        </p>
      </a>

      {/* Date + Delete */}
      <div className="flex-shrink-0 flex items-center gap-3">
        <span className="hidden sm:block font-mono text-xs text-muted/70">
          {formatDate(bookmark.created_at)}
        </span>

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="delete-btn w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-muted hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all duration-150 disabled:cursor-not-allowed"
          aria-label="Delete bookmark"
          title="Delete"
        >
          {deleting ? (
            <svg
              className="animate-spin w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
