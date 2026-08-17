import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { Settings as SettingsType } from "../types";

export default function Settings() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ settings: SettingsType }>("/api/settings", token).then((r) => setSettings(r.settings));
  }, [token]);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const { id, ...rest } = settings;
      void id;
      const res = await api.put<{ settings: SettingsType }>("/api/settings", token, rest);
      setSettings(res.settings);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save settings");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <div className="h-40 flex items-center justify-center text-slate-400 text-sm">Loading…</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-500">Changes only affect future check-ins and future trend calculations — historical responses are never rewritten.</p>
      </div>

      <Section title="Check-in Window">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Start Time">
            <input
              type="time"
              value={settings.checkinStartTime}
              onChange={(e) => setSettings({ ...settings, checkinStartTime: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="End Time">
            <input
              type="time"
              value={settings.checkinEndTime}
              onChange={(e) => setSettings({ ...settings, checkinEndTime: e.target.value })}
              className="input"
            />
          </Field>
        </div>
        <Toggle label="Mandatory check-in" checked={settings.mandatory} onChange={(v) => setSettings({ ...settings, mandatory: v })} />
        <Toggle
          label="Allow late check-ins outside the window"
          checked={settings.allowLateCheckins}
          onChange={(v) => setSettings({ ...settings, allowLateCheckins: v })}
        />
        <Field label="Prompt delay after login (seconds)">
          <input
            type="number"
            min={0}
            value={settings.promptDelaySeconds}
            onChange={(e) => setSettings({ ...settings, promptDelaySeconds: Number(e.target.value) })}
            className="input w-32"
          />
        </Field>
      </Section>

      <Section title="Trend Detection">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Low-mood threshold (responses)">
            <input
              type="number"
              min={1}
              value={settings.lowMoodThresholdCount}
              onChange={(e) => setSettings({ ...settings, lowMoodThresholdCount: Number(e.target.value) })}
              className="input"
            />
          </Field>
          <Field label="Low-mood window (days)">
            <input
              type="number"
              min={1}
              value={settings.lowMoodWindowDays}
              onChange={(e) => setSettings({ ...settings, lowMoodWindowDays: Number(e.target.value) })}
              className="input"
            />
          </Field>
          <Field label="Declining-trend window (days)">
            <input
              type="number"
              min={6}
              value={settings.decliningWindowDays}
              onChange={(e) => setSettings({ ...settings, decliningWindowDays: Number(e.target.value) })}
              className="input"
            />
          </Field>
          <Field label="Data retention (days)">
            <input
              type="number"
              min={30}
              value={settings.retentionDays}
              onChange={(e) => setSettings({ ...settings, retentionDays: Number(e.target.value) })}
              className="input"
            />
          </Field>
        </div>
      </Section>

      <Section title="Timezone">
        <Field label="Organization timezone (IANA)">
          <input value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} className="input" />
        </Field>
      </Section>

      {error && <p className="text-sm text-rose-500">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-full bg-brand-600 text-white px-6 py-2.5 text-sm font-semibold hover:bg-brand-700 disabled:opacity-60 transition-colors"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {savedAt && Date.now() - savedAt < 4000 && <span className="text-xs text-emerald-600">Saved</span>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-100 p-6 space-y-4">
      <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded" />
      <span className="text-sm text-slate-600">{label}</span>
    </label>
  );
}
