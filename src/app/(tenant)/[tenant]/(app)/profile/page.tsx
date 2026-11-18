"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * `/profile` predates the account section; keep old links working without a
 * second profile implementation.
 */
export default function ProfileRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/account/profile");
  }, [router]);

  return null;
}
