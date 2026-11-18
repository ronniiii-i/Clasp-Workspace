"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Laptop,
  Loader2,
  Monitor,
  ShieldCheck,
  Smartphone,
  Tablet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/modal";
import { apiRequest, ApiError } from "@/services/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { formatDateTime, formatRelative } from "@/lib/format";

interface SessionDto {
  id: string;
  current: boolean;
  deviceLabel: string;
  browser?: string;
  os?: string;
  ip?: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

interface SessionsResponse {
  sessions: SessionDto[];
  currentSessionId: string | null;
}

function DeviceIcon({ session }: { session: SessionDto }) {
  const os = (session.os ?? "").toLowerCase();
  const label = session.deviceLabel.toLowerCase();

  if (os === "ios" || os === "android" || label.includes("iphone")) {
    return <Smartphone className="h-5 w-5" aria-hidden="true" />;
  }
  if (label.includes("ipad") || label.includes("tablet")) {
    return <Tablet className="h-5 w-5" aria-hidden="true" />;
  }
  if (os === "macos" || os === "windows" || os === "linux") {
    return <Laptop className="h-5 w-5" aria-hidden="true" />;
  }
  return <Monitor className="h-5 w-5" aria-hidden="true" />;
}

function SessionSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border p-4">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
      <Skeleton className="h-8 w-20" />
    </div>
  );
}

export default function AccountSecurityPage() {
  const logout = useAuthStore((state) => state.logout);
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<SessionsResponse>("/auth/sessions", {
        errorMessage: "Could not load your sessions",
      });
      setSessions(data.sessions ?? []);
    } catch (caught) {
      const message =
        caught instanceof ApiError
          ? caught.message
          : "Could not load your sessions";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const otherSessions = useMemo(
    () => sessions.filter((session) => !session.current),
    [sessions],
  );

  const revokeOne = async (session: SessionDto) => {
    setBusyId(session.id);
    const snapshot = sessions;

    if (!session.current) {
      setSessions((current) =>
        current.filter((item) => item.id !== session.id),
      );
    }

    try {
      await apiRequest(`/auth/sessions/${session.id}`, {
        method: "DELETE",
        errorMessage: "Could not revoke that session",
      });

      if (session.current) {
        toast.success("Signed out of this device");
        await logout();
        return;
      }

      toast.success("Session revoked");
    } catch (caught) {
      if (!session.current) setSessions(snapshot);
      toast.error(
        caught instanceof ApiError ? caught.message : "Could not revoke session",
      );
    } finally {
      setBusyId(null);
    }
  };

  const revokeOthers = async () => {
    setRevokingOthers(true);
    try {
      const result = await apiRequest<{ revoked: number }>(
        "/auth/sessions/revoke-others",
        {
          method: "POST",
          errorMessage: "Could not revoke the other sessions",
        },
      );
      setSessions((current) => current.filter((item) => item.current));
      setConfirmOpen(false);
      toast.success(
        result.revoked === 1
          ? "Revoked 1 other session"
          : `Revoked ${result.revoked} other sessions`,
      );
    } catch (caught) {
      toast.error(
        caught instanceof ApiError
          ? caught.message
          : "Could not revoke the other sessions",
      );
    } finally {
      setRevokingOthers(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Account security
        </h1>
        <p className="text-sm text-muted-foreground">
          Review the devices signed in to your account and sign out anything
          you do not recognise.
        </p>
      </div>

      <Card className="border-border">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">Active sessions</CardTitle>
            <CardDescription>
              Each session expires automatically. Revoking one takes effect
              immediately.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={() => setConfirmOpen(true)}
            disabled={otherSessions.length === 0 || loading || revokingOthers}
          >
            {revokingOthers ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Revoking…
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" /> Revoke all other sessions
              </>
            )}
          </Button>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          {loading ? (
            <>
              <SessionSkeleton />
              <SessionSkeleton />
            </>
          ) : error ? (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void load()}>
                Try again
              </Button>
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-sm font-medium">No active sessions</p>
              <p className="text-sm text-muted-foreground">
                Sign in again to create a session.
              </p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <DeviceIcon session={session} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">
                        {session.deviceLabel || "Unknown device"}
                      </p>
                      {session.current ? (
                        <Badge variant="secondary">This device</Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last active {formatRelative(session.lastSeenAt)}
                      {session.ip ? ` · ${session.ip}` : ""}
                    </p>
                    {session.createdAt ? (
                      <p className="text-xs text-muted-foreground">
                        Signed in {formatDateTime(session.createdAt)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void revokeOne(session)}
                  disabled={busyId === session.id}
                >
                  {busyId === session.id ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Revoking…
                    </>
                  ) : session.current ? (
                    "Sign out"
                  ) : (
                    "Revoke"
                  )}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Need to change your password?{" "}
        <Link href="/profile" className="underline underline-offset-4">
          Go to your profile
        </Link>
        .
      </p>

      <Modal
        open={confirmOpen}
        onClose={() => {
          if (!revokingOthers) setConfirmOpen(false);
        }}
        title="Revoke other sessions?"
        description={`This will sign out ${otherSessions.length} other ${
          otherSessions.length === 1 ? "session" : "sessions"
        }. This device stays signed in.`}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={revokingOthers}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void revokeOthers()}
              disabled={revokingOthers}
            >
              {revokingOthers ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Revoking…
                </>
              ) : (
                "Revoke sessions"
              )}
            </Button>
          </>
        }
      />
    </div>
  );
}
