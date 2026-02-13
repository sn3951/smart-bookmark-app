"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import Image from "next/image";

interface UserMenuProps {
  user: User;
  displayName: string;
}

export default function UserMenu({ user, displayName }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // useMemo prevents creating a new client on every render
  const supabase = useMemo(() => createClient(), []);

  const avatarUrl = user.user_metadata?.avatar_url;

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    // Just call signOut — do NOT manually push to "/".
    // DashboardClient's onAuthStateChange listener handles the redirect
    // for BOTH the current tab and all other open tabs.
    // Manually pushing here races with that listener and causes the "stuck" bug.
    const { error } = await supabase.auth.signOut();
    if (error) {
      // If signOut fails, reset so the user can try again
      console.error("Sign out error:", error);
      setSigningOut(false);
    }
    // On success: onAuthStateChange fires SIGNED_OUT → router.push("/") in DashboardClient
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-border/60 transition-colors"
      >
        {/* Avatar */}
        <div className="w-6 h-6 rounded-full overflow-hidden bg-accent flex items-center justify-center">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={displayName}
              width={24}
              height={24}
              className="w-full h-full object-cover"
              unoptimized
            />
          ) : (
            <span className="text-white text-xs font-bold">
              {displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <span className="font-medium text-sm hidden sm:block max-w-[120px] truncate">
          {displayName}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-paper border border-border rounded-xl shadow-lg overflow-hidden z-20 animate-fade-up">
          {/* User info */}
          <div className="px-4 py-3 border-b border-border">
            <p className="font-semibold text-sm truncate">{displayName}</p>
            <p className="text-muted text-xs truncate">{user.email}</p>
          </div>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left hover:bg-surface transition-colors text-muted hover:text-ink disabled:opacity-60"
          >
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
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}