import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { EDUCATION_LEVELS, WEEKDAYS, SUBJECT_COLORS } from '@/lib/spacedRepetition';
import { GraduationCap, ArrowRight, ArrowLeft, Plus, X, Check } from 'lucide-react';

type SubjectEntry = {
  name: string;
  exam_board: string;
  qualification_level: string;
  color: string;
};

export function OnboardingPage() {
  const { user, updateProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [educationLevel, setEducationLevel] = useState(EDUCATION_LEVELS[0]);
  const [school, setSchool] = useState('');
  const [subjects, setSubjects] = useState<SubjectEntry[]>([{ name: '', exam_board: '', qualification_level: EDUCATION_LEVELS[0], color: SUBJECT_COLORS[0] }]);
  const [studyDays, setStudyDays] = useState<string[]>([]);
  const [hoursPerWeek, setHoursPerWeek] = useState(10);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = ['Profile', 'Education', 'Subjects', 'Schedule'];

  const toggleDay = (day: string) => {
    setStudyDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const addSubject = () => {
    setSubjects((prev) => [
      ...prev,
      { name: '', exam_board: '', qualification_level: educationLevel, color: SUBJECT_COLORS[prev.length % SUBJECT_COLORS.length] },
    ]);
  };

  const removeSubject = (idx: number) => {
    setSubjects((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateSubject = (idx: number, field: keyof SubjectEntry, value: string) => {
    setSubjects((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);

    const validSubjects = subjects.filter((s) => s.name.trim());

    // Save subjects before marking onboarding complete. If the insert fails,
    // the student stays on this page and can safely retry.
    const { data: existingSubjects, error: existingErr } = await supabase
      .from('subjects')
      .select('name')
      .eq('user_id', user.id);

    if (existingErr) {
      setError(existingErr.message);
      setSaving(false);
      return;
    }

    const existingNames = new Set(
      (existingSubjects ?? []).map((s) => s.name.trim().toLowerCase())
    );
    const newSubjects = validSubjects.filter(
      (s) => !existingNames.has(s.name.trim().toLowerCase())
    );

    if (newSubjects.length > 0) {
      const rows = newSubjects.map((s, i) => ({
        user_id: user.id,
        name: s.name.trim(),
        exam_board: s.exam_board.trim() || null,
        qualification_level: s.qualification_level || educationLevel,
        color: s.color,
        position: (existingSubjects?.length ?? 0) + i,
      }));
      const { error: subErr } = await supabase.from('subjects').insert(rows);
      if (subErr) {
        setError(subErr.message);
        setSaving(false);
        return;
      }
    }

    // Only complete onboarding after the subject records have been saved.
    const { error: profErr } = await updateProfile({
      display_name: displayName,
      education_level: educationLevel,
      school: school || null,
      preferred_study_days: studyDays,
      availability_hours_per_week: hoursPerWeek,
      onboarded: true,
    });
    if (profErr) {
      setError(profErr);
      setSaving(false);
      return;
    }

    setSaving(false);
    // AuthContext will reload profile via onAuthStateChange, but let's force a refresh
    window.location.reload();
  };

  const canProceed = () => {
    if (step === 0) return displayName.trim().length > 0;
    if (step === 1) return educationLevel.length > 0;
    if (step === 2) return subjects.filter((s) => s.name.trim()).length > 0;
    return true;
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white">
            <GraduationCap size={22} />
          </div>
          <span className="text-xl font-bold text-primary">StudyTrack</span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex-1 flex items-center gap-2">
              <div
                className={`flex-1 h-2 rounded-full transition-colors ${
                  i <= step ? 'bg-brand-500' : 'surface-tertiary'
                }`}
              />
            </div>
          ))}
        </div>

        <div className="card p-8">
          <h2 className="text-2xl font-bold text-primary mb-1">{steps[step]}</h2>
          <p className="text-secondary text-sm mb-6">
            Step {step + 1} of {steps.length}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-1.5">Display name</label>
                <input
                  className="input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex Johnson"
                  autoFocus
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-1.5">Main qualification</label>
                <p className="text-xs text-tertiary mb-2">This is your default. You can choose a different qualification for each subject in the next step, such as A-Level Biology and BTEC Applied Science.</p>
                <select className="input" value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)}>
                  {EDUCATION_LEVELS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-1.5">
                  School, college or university <span className="text-tertiary">(optional)</span>
                </label>
                <input
                  className="input"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder="e.g. King's College London"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              {subjects.map((s, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg surface-tertiary">
                  <input
                    type="color"
                    value={s.color}
                    onChange={(e) => updateSubject(idx, 'color', e.target.value)}
                    className="w-10 h-10 rounded-lg border-0 cursor-pointer shrink-0 mt-1"
                  />
                  <div className="flex-1 space-y-2">
                    <input
                      className="input"
                      value={s.name}
                      onChange={(e) => updateSubject(idx, 'name', e.target.value)}
                      placeholder="Subject name (e.g. Biology)"
                    />
                    <select
                      className="input"
                      value={s.qualification_level}
                      onChange={(e) => updateSubject(idx, 'qualification_level', e.target.value)}
                      aria-label={`Qualification for ${s.name || `subject ${idx + 1}`}`}
                    >
                      {EDUCATION_LEVELS.map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                    <input
                      className="input"
                      value={s.exam_board}
                      onChange={(e) => updateSubject(idx, 'exam_board', e.target.value)}
                      placeholder="Exam board (optional, e.g. AQA)"
                    />
                  </div>
                  {subjects.length > 1 && (
                    <button onClick={() => removeSubject(idx)} className="btn-ghost btn !p-2 mt-1">
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addSubject} className="btn btn-secondary w-full">
                <Plus size={16} /> Add another subject
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-secondary mb-3">Preferred study days</label>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((day) => (
                    <button
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        studyDays.includes(day)
                          ? 'bg-brand-500 text-white'
                          : 'surface-tertiary text-secondary hover:text-primary'
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
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
              className="btn btn-secondary disabled:opacity-50"
            >
              <ArrowLeft size={16} /> Back
            </button>
            {step < steps.length - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceed()}
                className="btn btn-primary disabled:opacity-50"
              >
                Continue <ArrowRight size={16} />
              </button>
            ) : (
              <button onClick={handleFinish} disabled={saving} className="btn btn-primary disabled:opacity-50">
                {saving ? 'Setting up...' : 'Get started'} <Check size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
