"use client";

import { useEffect } from "react";
import { useAccount } from "./auth-gate";

export function ServiceWorkerRegistration() {
  const account = useAccount();
  const userId = account?.id;
  useEffect(() => {
    if (!userId || !("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") {
      return;
    }

    void navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }, [userId]);

  return null;
}
