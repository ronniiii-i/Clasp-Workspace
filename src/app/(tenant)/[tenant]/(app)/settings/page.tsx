"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useAuthStore } from "@/stores/auth-store";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import type { WorkspaceSettings } from "@/lib/modules";

const API_BASE = process.env.NEXT_PUBLIC_API || "http://localhost:3030";

const CURRENCIES = [
  { value: "NGN", label: "Nigerian naira (NGN)" },
  { value: "USD", label: "US dollar (USD)" },
  { value: "GBP", label: "Pound sterling (GBP)" },
  { value: "EUR", label: "Euro (EUR)" },
  { value: "CAD", label: "Canadian dollar (CAD)" },
  { value: "AUD", label: "Australian dollar (AUD)" },
  { value: "ZAR", label: "South African rand (ZAR)" },
  { value: "KES", label: "Kenyan shilling (KES)" },
  { value: "GHS", label: "Ghanaian cedi (GHS)" },
  { value: "INR", label: "Indian rupee (INR)" },
];

const DATE_FORMATS = [
  "d MMM yyyy",
  "dd/MM/yyyy",
  "MM/dd/yyyy",
  "yyyy-MM-dd",
  "d MMMM yyyy",
];

const LOCALES = [
  { value: "en-NG", label: "English (Nigeria)" },
  { value: "en-US", label: "English (United States)" },
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "fr-FR", label: "French (France)" },
  { value: "ar-EG", label: "Arabic (Egypt)" },
];

const TIME_ZONES = [
  "UTC",
  "Africa/Lagos",
  "Africa/Accra",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
];

const WEEK_STARTS = [
  { value: "1", label: "Monday" },
  { value: "0", label: "Sunday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

interface SettingsForm {
  name: string;
  currency: string;
  currencySymbol: string;
  dateFormat: string;
  timeZone: string;
  locale: string;
  weekStartsOn: string;
}

const EMPTY_FORM: SettingsForm = {
  name: "",
  currency: "USD",
  currencySymbol: "",
  dateFormat: "d MMM yyyy",
  timeZone: "UTC",
  locale: "en-US",
  weekStartsOn: "1",
};

function toForm(settings: WorkspaceSettings & { name?: string; slug?: string }): SettingsForm {
  return {
    name: settings.name ?? "",
    currency: settings.currency ?? EMPTY_FORM.currency,
    currencySymbol: settings.currencySymbol ?? "",
    dateFormat: settings.dateFormat ?? EMPTY_FORM.dateFormat,
    timeZone: settings.timeZone ?? EMPTY_FORM.timeZone,
    locale: settings.locale ?? EMPTY_FORM.locale,
    weekStartsOn: String(settings.weekStartsOn ?? 1),
  };
}

export default function SettingsGeneralPage() {
  const token = useAuthStore((state) => state.token);
  const refreshUserData = useAuthStore((state) => state.refreshUserData);
  const updateWorkspaceSettings = useAuthStore(
    (state) => state.updateWorkspaceSettings,
  );

  const [form, setForm] = useState<SettingsForm>(EMPTY_FORM);
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/tenant/settings`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      if (res.ok) {
        const data = await res.json();
        setForm(toForm(data?.settings ?? EMPTY_FORM));
        setSlug(data?.settings?.slug ?? "");

        // Keep the cached profile in sync so the header/sidebar show the
        // workspace name even when the login payload predates this field.
        const current = useAuthStore.getState().user;
        if (current && data?.settings?.name && current.tenantName !== data.settings.name) {
          useAuthStore.setState({
            user: {
              ...current,
              tenantName: data.settings.name,
              tenantSlug: data.settings.slug ?? current.tenantSlug,
            },
          });
        }
        return;
      }
      // Fall back to the cached session when the request is not available.
      const current = useAuthStore.getState().user;
      setForm((value) => ({ ...value, name: current?.tenantName ?? "" }));
      setSlug(current?.tenantSlug ?? "");
    } catch {
      const current = useAuthStore.getState().user;
      setForm((value) => ({ ...value, name: current?.tenantName ?? "" }));
      setSlug(current?.tenantSlug ?? "");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) load();
  }, [token, load]);

  const setField = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const previewSettings = useMemo(
    () => ({
      currency: form.currency,
      currencySymbol: form.currencySymbol || null,
      dateFormat: form.dateFormat,
      timeZone: form.timeZone,
      locale: form.locale,
      weekStartsOn: Number(form.weekStartsOn),
    }),
    [form],
  );

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Workspace name cannot be empty");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/tenant/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          name: form.name.trim(),
          currency: form.currency,
          currencySymbol: form.currencySymbol.trim(),
          dateFormat: form.dateFormat,
          timeZone: form.timeZone,
          locale: form.locale,
          weekStartsOn: Number(form.weekStartsOn),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join(", ")
            : data.message || "Failed to save workspace",
        );
      }

      const saved: WorkspaceSettings = data?.settings ?? previewSettings;
      setForm(toForm(data?.settings ?? { ...saved, name: form.name.trim() }));
      setSlug(data?.settings?.slug ?? slug);
      updateWorkspaceSettings(saved);
      await refreshUserData();
      toast.success("Workspace settings saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save workspace",
      );
    } finally {
      setSaving(false);
    }
  };

  const disabled = loading || saving;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Workspace settings</h1>
        <p className="text-sm text-muted-foreground">
          How dates, money and numbers appear for everyone in this workspace.
        </p>
      </div>

      <Card className="max-w-2xl border-border">
        <CardHeader>
          <CardTitle className="text-base">General</CardTitle>
          <CardDescription>The workspace URL is permanent.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="workspace-name">Workspace name</Label>
            <Input
              id="workspace-name"
              value={form.name}
              placeholder={loading ? "Loading…" : "Workspace name"}
              onChange={(event) => setField("name", event.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="workspace-slug">Workspace slug</Label>
            <Input id="workspace-slug" value={slug} readOnly disabled className="font-mono" />
            <p className="text-xs text-muted-foreground">
              Sign-in address: <span className="font-mono">{slug || "your-workspace"}.localhost:3000/login</span>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-2xl border-border">
        <CardHeader>
          <CardTitle className="text-base">Regional preferences</CardTitle>
          <CardDescription>
            Used across tables, dashboards, exports and email.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="workspace-currency">Currency</Label>
              <Select
                id="workspace-currency"
                value={form.currency}
                onChange={(event) => setField("currency", event.target.value)}
                disabled={disabled}
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency.value} value={currency.value}>
                    {currency.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="workspace-symbol">Currency symbol (optional)</Label>
              <Input
                id="workspace-symbol"
                value={form.currencySymbol}
                onChange={(event) => setField("currencySymbol", event.target.value)}
                placeholder="Auto from locale"
                maxLength={3}
                disabled={disabled}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to use the locale default.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="workspace-date-format">Date format</Label>
              <Select
                id="workspace-date-format"
                value={form.dateFormat}
                onChange={(event) => setField("dateFormat", event.target.value)}
                disabled={disabled}
              >
                {DATE_FORMATS.map((format) => (
                  <option key={format} value={format}>
                    {format}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="workspace-locale">Language &amp; number format</Label>
              <Select
                id="workspace-locale"
                value={form.locale}
                onChange={(event) => setField("locale", event.target.value)}
                disabled={disabled}
              >
                {LOCALES.map((locale) => (
                  <option key={locale.value} value={locale.value}>
                    {locale.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="workspace-timezone">Time zone</Label>
              <Input
                id="workspace-timezone"
                list="workspace-timezones"
                value={form.timeZone}
                onChange={(event) => setField("timeZone", event.target.value)}
                placeholder="Africa/Lagos"
                disabled={disabled}
                className="font-mono"
              />
              <datalist id="workspace-timezones">
                {TIME_ZONES.map((zone) => (
                  <option key={zone} value={zone} />
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">
                Any IANA timezone name is accepted.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="workspace-week-start">Week starts on</Label>
              <Select
                id="workspace-week-start"
                value={form.weekStartsOn}
                onChange={(event) => setField("weekStartsOn", event.target.value)}
                disabled={disabled}
              >
                {WEEK_STARTS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/40 p-4 text-sm">
            <p className="mb-2 font-medium">Preview</p>
            <dl className="grid gap-1 sm:grid-cols-2">
              <div className="flex justify-between gap-4 sm:block">
                <dt className="text-muted-foreground">Date</dt>
                <dd>{formatDate(new Date(), previewSettings)}</dd>
              </div>
              <div className="flex justify-between gap-4 sm:block">
                <dt className="text-muted-foreground">Currency</dt>
                <dd>{formatCurrency(1250000, previewSettings)}</dd>
              </div>
              <div className="flex justify-between gap-4 sm:block">
                <dt className="text-muted-foreground">Number</dt>
                <dd>{formatNumber(1234567.89, previewSettings)}</dd>
              </div>
            </dl>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={disabled}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
