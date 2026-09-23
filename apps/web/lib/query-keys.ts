export const queryKeys = {
  auth: { me: ["auth", "me"] as const },
  me: { stats: ["me", "stats"] as const },
  admin: {
    users: ["admin", "users"] as const,
    stats: ["admin", "stats"] as const,
    attempts: (userId: string) => ["admin", "attempts", userId] as const,
  },
} as const;
