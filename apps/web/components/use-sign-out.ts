"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { logout } from "@/lib/api/client";
import { clearAccountMarker } from "@/lib/auth/account-marker";

/**
 * Ends the session on the server first, then forgets the verified account on this device.
 * The local marker and cached queries stay intact when the server call fails, so a failed
 * sign-out never looks like a successful one.
 */
export function useSignOut(): () => Promise<void> {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useCallback(async () => {
    await logout();
    clearAccountMarker();
    queryClient.clear();
    router.replace("/login");
    router.refresh();
  }, [queryClient, router]);
}
