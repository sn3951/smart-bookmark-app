export interface Bookmark {
  id: string;
  user_id: string;
  title: string;
  url: string;
  favicon?: string;
  created_at: string;
}

export interface User {
  id: string;
  email?: string;
  user_metadata: {
    full_name?: string;
    avatar_url?: string;
    name?: string;
  };
}

export type BookmarkInsert = Omit<Bookmark, "id" | "created_at" | "user_id">;
