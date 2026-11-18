"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type LoginResponse = {
  accessToken?: string;
  user?: {
    role?: { isTenantAdmin?: boolean };
    tenantStatus?: string;
  };
};

// Shared-site QA only. These are the seeded Acme demo accounts; the password is
// the public DEMO_PASSWORD from prisma/seed/workspaces/index.ts. Sign-in still
// goes through /api/auth/login, so the token, httpOnly cookie and all existing
// billing/account-locked/dashboard routing are unchanged.
const ACME_TEST_PASSWORD = "Password123!";
const ACME_TEST_USERS = [
  { email: "admin@acme.test", label: "Avery Admin — Tenant Admin" },
  { email: "finance.hod@acme.test", label: "Finley Hart — Finance HOD" },
  { email: "sales.hod@acme.test", label: "Harper Quinn — Sales HOD" },
  { email: "hr.hod@acme.test", label: "Hollis Bennett — HR HOD" },
  { email: "it.hod@acme.test", label: "Ira Novak — IT HOD" },
  { email: "sales.lead@acme.test", label: "Skyler Lane — Sales Team Lead" },
  { email: "staff@acme.test", label: "Sam Reed — Sales Staff" },
  { email: "ops.staff@acme.test", label: "Owen Price — Operations Staff" },
  { email: "support.staff@acme.test", label: "Sage Moreno — Support Staff" },
];

export default function TenantLoginPage() {
  const params = useParams();
  const router = useRouter();
  const tenant = params?.tenant as string | undefined;
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";
  const protocol = process.env.NEXT_PUBLIC_ROOT_PROTOCOL || "http";
  const apexFindWorkspaceUrl = `${protocol}://${rootDomain}/find-workspace`;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [testUser, setTestUser] = useState("");

  const testLoginEnabled = process.env.NEXT_PUBLIC_TEST_LOGIN_ENABLED === "true";
  const showTestLogin = testLoginEnabled && tenant?.toLowerCase() === "acme";

  function completeSignIn(data: LoginResponse) {
    if (!data?.accessToken || !data?.user) {
      setError("Login failed. Please try again.");
      setLoading(false);
      return;
    }

    localStorage.setItem("clasp_token_v3", data.accessToken);
    localStorage.setItem("auth_user_v3", JSON.stringify(data.user));

    if (data.user.role?.isTenantAdmin && data.user.tenantStatus === "PAST_DUE") {
      router.push("/settings/billing");
      return;
    }
    if (data.user.tenantStatus === "PAST_DUE" || data.user.tenantStatus === "SUSPENDED") {
      router.push("/account-locked");
      return;
    }
    router.push("/dashboard");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, tenantSlug: tenant }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.message || "Invalid credentials");
        setLoading(false);
        return;
      }

      const data = (await response.json()) as LoginResponse;
      completeSignIn(data);
    } catch {
      setError("Invalid credentials");
      setLoading(false);
    }
  }

  async function handleTestLogin(email: string) {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: ACME_TEST_PASSWORD, tenantSlug: "acme" }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        setError(data.message || "Test sign-in failed");
        setLoading(false);
        return;
      }

      completeSignIn((await response.json()) as LoginResponse);
    } catch {
      setError("Test sign-in failed");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl tracking-tight">Sign in to {tenant}</CardTitle>
          <CardDescription>Enter your credentials to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
            <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
              <Link href="/forgot-password" className="underline underline-offset-4 hover:text-foreground">
                Forgot password?
              </Link>
              <Link href={apexFindWorkspaceUrl} className="underline underline-offset-4 hover:text-foreground">
                Find a different workspace
              </Link>
            </div>
          </form>
          {showTestLogin && (
            <div className="mt-6 flex flex-col gap-3 border-t pt-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="test-user">Testing — proceed as</Label>
                <select
                  id="test-user"
                  value={testUser}
                  onChange={(event) => {
                    const email = event.target.value;
                    setTestUser(email);
                    if (email) void handleTestLogin(email);
                  }}
                  disabled={loading}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select a test user…</option>
                  {ACME_TEST_USERS.map((user) => (
                    <option key={user.email} value={user.email}>
                      {user.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Selecting a user signs you in instantly (shared-site testing only).
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
