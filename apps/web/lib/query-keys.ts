export const queryKeys = {
  auth: { me: ["auth", "me"] as const },
  me: {
    profile: ["me", "profile"] as const,
    stats: ["me", "stats"] as const,
    attemptStats: (userId: string) => ["me", "attempt-stats", userId] as const,
    periodicMastery: (userId: string) => ["me", "periodic-mastery", userId] as const,
    practiceCheckpoints: (userId: string) => ["me", "practice-checkpoints", userId] as const,
  },
  admin: {
    users: ["admin", "users"] as const,
    stats: ["admin", "stats"] as const,
    profile: (userId: string) => ["admin", "profile", userId] as const,
    attempts: (userId: string) => ["admin", "attempts", userId] as const,
  },
} as const;
