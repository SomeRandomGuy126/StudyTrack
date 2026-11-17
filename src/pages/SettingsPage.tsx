import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, ACCENTS } from '@/contexts/ThemeContext';
import { EDUCATION_LEVELS, WEEKDAYS } from '@/lib/spacedRepetition';
import { Check, Moon, Sun, User, GraduationCap, Sparkles, Palette } from 'lucide-react';

// Update this whenever a user-facing StudyTrack change is committed.
const APP_VERSION = '2.1.1';

const AI_TONES = [
  { id: 'friendly', label: 'Friendly', hint: 'Warm and supportive' },
  { id: 'formal', label: 'Formal', hint: 'Precise and academic' },
  { id: 'encouraging', label: 'Encouraging', hint: 'Motivating coach style' },
  { id: 'concise', label: 'Concise', hint: 'Short and to the point' },
];

const AI_DEPTHS = [
  { id: 'simple', label: 'Simple', hint: 'Plain language, no jargon' },
  { id: 'balanced', label: 'Balanced', hint: 'Clear with key detail' },
  { id: 'thorough', label: 'Thorough', hint: 'Full depth and examples' },
];

export function SettingsPage() {
  const { profile, updateProfile, signOut } = useAuth();
  const { themeMode, setTheme, accent, setAccent, interfaceSize, setInterfaceSize } = useTheme();
  const [aiTone, setAiTone] = useState(profile?.ai_tone ?? 'friendly');
  const [aiDepth, setAiDepth] = useState(profile?.ai_depth ?? 'balanced');
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [educationLevel, setEducationLevel] = useState(profile?.education_level ?? EDUCATION_LEVELS[0]);
  const [school, setSchool] = useState(profile?.school ?? '');
  const [studyDays, setStudyDays] = useState<string[]>(profile?.preferred_study_days ?? []);
  const [hoursPerWeek, setHoursPerWeek] = useState(profile?.availability_hours_per_week ?? 10);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggleDay = (day: string) => {
    setStudyDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handleSave = async () => {
    setSaving(true);
    await updateProfile({
      display_name: displayName,
      education_level: educationLevel,
      school: school || null,
      preferred_study_days: studyDays,
      availability_hours_per_week: hoursPerWeek,
      ai_tone: aiTone,
      ai_depth: aiDepth,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Settings</h1>
        <p className="text-secondary text-sm mt-1">Manage your profile and preferences</p>
      </div>

      <div className="space-y-6">
        {/* Profile */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <User size={18} className="text-brand-500" />
            <h3 className="font-semibold text-primary">Profile</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">Display name</label>
              <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-secondary mb-1.5">Education level</label>
                <select className="input" value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)}>
                  {EDUCATION_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-1.5">School / institution</label>
                <input className="input" value={school} onChange={(e) => setSchool(e.target.value)} placeholder="Optional" />
              </div>
            </div>
          </div>
        </div>

        {/* Study preferences */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap size={18} className="text-brand-500" />
            <h3 className="font-semibold text-primary">Study preferences</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-3">Preferred study days</label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      studyDays.includes(day) ? 'bg-brand-500 text-white' : 'surface-tertiary text-secondary hover:text-primary'
                    }`}
                  >
                    {studyDays.includes(day) && <Check size={14} className="inline mr-1" />}
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Weekly availability: <span className="text-brand-600">{hoursPerWeek} hours</span>
              </label>
              <input
                type="range"
                min="1"
                max="40"
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(Number(e.target.value))}
                className="w-full accent-brand-500"
              />
            </div>
          </div>
        </div>

        {/* AI preferences */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={18} className="text-brand-500" />
            <h3 className="font-semibold text-primary">AI preferences</h3>
          </div>
          <p className="text-sm text-tertiary mb-4">Applies to every AI tool: flashcards, notes, quizzes and the tutor.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Tone</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {AI_TONES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setAiTone(t.id)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${aiTone === t.id ? 'border-brand-500' : 'border-app'}`}
                  >
                    <p className="text-sm font-medium text-primary">{t.label}</p>
                    <p className="text-xs text-tertiary mt-0.5">{t.hint}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Explanation depth</label>
              <div className="grid grid-cols-3 gap-2">
                {AI_DEPTHS.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setAiDepth(d.id)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${aiDepth === d.id ? 'border-brand-500' : 'border-app'}`}
                  >
                    <p className="text-sm font-medium text-primary">{d.label}</p>
                    <p className="text-xs text-tertiary mt-0.5">{d.hint}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Palette size={18} className="text-brand-500" />
            <h3 className="font-semibold text-primary">Appearance</h3>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-secondary mb-2">Theme palette</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAccent(a.id)}
                  aria-pressed={accent === a.id}
                  className={`flex items-center gap-2 rounded-lg border p-2 text-left transition-all ${accent === a.id ? 'border-brand-500 bg-brand-500/5' : 'border-app hover:surface-tertiary'}`}
                >
                  <span className="w-7 h-7 rounded-full shrink-0 ring-1 ring-black/10" style={{ background: `linear-gradient(135deg, ${a.secondary}, ${a.color})` }} />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-primary">{a.label}</span>
                    <span className="block text-[10px] text-tertiary">{a.hint}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-tertiary mt-2">Web Hero and Grand Voyage are original colour palettes, not official character artwork or logos.</p>
          </div>
          <label className="block text-sm font-medium text-secondary mb-2">Colour mode</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: 'light', label: 'Light', icon: Sun },
              { id: 'dark', label: 'Dark', icon: Moon },
              { id: 'system', label: 'System', icon: Sparkles },
            ] as const).map((mode) => {
              const ModeIcon = mode.icon;
              return (
                <button
                  key={mode.id}
                  onClick={() => setTheme(mode.id)}
                  aria-pressed={themeMode === mode.id}
                  className={`p-3 rounded-lg border-2 transition-all ${themeMode === mode.id ? 'border-brand-500 bg-brand-500/5' : 'border-app'}`}
                >
                  <ModeIcon size={19} className="mx-auto mb-1.5 text-brand-500" />
                  <p className="text-sm font-medium text-primary">{mode.label}</p>
                </button>
              );
            })}
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-secondary mb-2">Interface size</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'compact', label: 'Compact' },
                { id: 'comfortable', label: 'Default' },
                { id: 'large', label: 'Large' },
              ] as const).map((size) => (
                <button
                  key={size.id}
                  onClick={() => setInterfaceSize(size.id)}
                  aria-pressed={interfaceSize === size.id}
                  className={`p-2.5 rounded-lg border-2 text-sm transition-all ${interfaceSize === size.id ? 'border-brand-500 bg-brand-500/5' : 'border-app'}`}
                >
                  {size.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-tertiary mt-2">Appearance preferences are saved on this device.</p>
          </div>
        </div>

        {/* App version */}
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-primary">About StudyTrack</h3>
              <p className="text-sm text-secondary mt-1">App version</p>
            </div>
            <span className="rounded-lg bg-brand-500/10 text-brand-600 px-3 py-1.5 text-sm font-semibold">
              v{APP_VERSION}
            </span>
          </div>
          <p className="text-xs text-tertiary mt-3">The version number changes when StudyTrack is updated.</p>
        </div>

        {/* Save button */}
        <div className="flex items-center justify-between">
          {saved && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <Check size={16} /> Saved successfully
            </span>
          )}
          <div className="flex gap-3 ml-auto">
            <button onClick={signOut} className="btn btn-secondary text-red-600">Sign out</button>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary disabled:opacity-50">
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
