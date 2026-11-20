import { useEffect, useState } from 'react';
import { Award, Car, Check, CheckCircle2, Hand, Loader2, ShieldCheck, User, Users } from 'lucide-react';
import type { ProfileRole, RideFeedback, UserProfile } from '../types/ride';
import {
  aggregateFeedbackTags,
  PROFILE_BIO_MAX_LENGTH,
  validateProfileInput,
} from '../utils/ridesLogic';
import { triggerHaptic } from '../utils/telegram';

interface ProfileViewProps {
  profile: UserProfile;
  feedbackList: RideFeedback[];
  isFallbackDemo: boolean;
  photoUrl: string | null;
  onSaveProfile: (next: {
    role: ProfileRole;
    carInfo: string;
    bio: string;
  }) => Promise<void>;
}

export function ProfileView({
  profile,
  feedbackList,
  isFallbackDemo,
  photoUrl,
  onSaveProfile,
}: ProfileViewProps) {
  const [role, setRole] = useState<ProfileRole>(profile.role);
  const [carInfo, setCarInfo] = useState(profile.carInfo);
  const [bio, setBio] = useState(profile.bio);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRole(profile.role);
    setCarInfo(profile.carInfo);
    setBio(profile.bio);
  }, [profile.telegramId, profile.role, profile.carInfo, profile.bio]);

  const tagCounts = aggregateFeedbackTags(feedbackList);
  const showCarField = role === 'driver' || role === 'both';

  const initials = (profile.firstName || 'П')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateProfileInput({ role, carInfo, bio });
    if (!check.valid) {
      setError(check.error ?? 'Проверьте введённые данные');
      return;
    }

    setError(null);
    setSaving(true);
    setSavedToast(false);
    try {
      await onSaveProfile({
        role,
        carInfo: showCarField ? carInfo : '',
        bio,
      });
      triggerHaptic('medium');
      setSavedToast(true);
      window.setTimeout(() => setSavedToast(false), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить профиль');
    } finally {
      setSaving(false);
    }
  };

  const roleOptions: {
    id: ProfileRole;
    label: string;
    icon: typeof Car;
  }[] = [
    { id: 'driver', label: 'Водитель', icon: Car },
    { id: 'passenger', label: 'Пассажир', icon: Hand },
    { id: 'both', label: 'И водитель, и пассажир', icon: Users },
  ];

  return (
    <div className="space-y-4 pb-2" data-testid="profile-view">
      {/* Identity & Stats Header Card */}
      <section className="rounded-2xl bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800/90 p-4 space-y-4">
        <div className="flex items-center gap-3.5">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={profile.firstName}
              className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[var(--accent-text)] font-extrabold text-base flex items-center justify-center shrink-0">
              {initials || <User className="w-5 h-5" />}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 truncate">
                {profile.firstName}
              </h2>
              {isFallbackDemo && (
                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                  Тест превью
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular truncate">
              {profile.username ? `@${profile.username}` : `Telegram ID: ${profile.telegramId}`}
            </p>
          </div>
        </div>

        {/* Counters */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-slate-50 dark:bg-[#0B0E14] border border-slate-200/80 dark:border-slate-800 p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
              <span>Совершено поездок</span>
            </div>
            <div
              className="mt-1 text-xl font-extrabold font-mono-tabular text-slate-900 dark:text-slate-100"
              data-testid="profile-completed-rides"
            >
              {profile.completedRides}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-[#0B0E14] border border-slate-200/80 dark:border-slate-800 p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <Award className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
              <span>Отметок доверия</span>
            </div>
            <div
              className="mt-1 text-xl font-extrabold font-mono-tabular text-slate-900 dark:text-slate-100"
              data-testid="profile-feedback-total"
            >
              {feedbackList.length}
            </div>
          </div>
        </div>

        {/* Received Trust Tags */}
        <div className="pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
            <ShieldCheck className="w-4 h-4 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
            <span>Теги от попутчиков</span>
          </div>
          {tagCounts.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Пока нет отметок. После совместных поездок попутчики смогут отметить вас быстрыми тегами.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5" data-testid="profile-trust-tags">
              {tagCounts.map((item) => (
                <span
                  key={item.tag}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent-border)] text-xs font-semibold text-slate-800 dark:text-slate-100"
                >
                  <span>{item.tag}</span>
                  <span className="font-mono-tabular font-bold text-[var(--accent-text)]">
                    · {item.count}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Editable Profile Settings Form */}
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="rounded-2xl bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800/90 p-4 space-y-4"
      >
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          Данные попутчика
        </h3>

        <fieldset>
          <legend className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
            Основная роль
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {roleOptions.map((opt) => {
              const Icon = opt.icon;
              const active = role === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setRole(opt.id);
                  }}
                  aria-pressed={active}
                  className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer text-left ${
                    active
                      ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)] font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300 dark:bg-[#0B0E14] dark:border-slate-800 dark:text-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="leading-tight">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {showCarField && (
          <div>
            <label
              htmlFor="profile-car-input"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Информация об авто
            </label>
            <input
              id="profile-car-input"
              type="text"
              maxLength={80}
              value={carInfo}
              onChange={(e) => setCarInfo(e.target.value)}
              placeholder="Например: Серый Ланос, АХ 1234"
              className="w-full min-h-[44px] rounded-xl bg-slate-50 dark:bg-[#0B0E14] border border-slate-300 dark:border-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[var(--accent-primary)]"
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Будет автоматически подставляться при создании маршрута.
            </p>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="profile-bio-input"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Короткая заметка о себе
            </label>
            <span className="text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400">
              {bio.length}/{PROFILE_BIO_MAX_LENGTH}
            </span>
          </div>
          <textarea
            id="profile-bio-input"
            rows={2}
            maxLength={PROFILE_BIO_MAX_LENGTH}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Например: Еду по утрам в Центр, не курю в салоне"
            className="w-full rounded-xl bg-slate-50 dark:bg-[#0B0E14] border border-slate-300 dark:border-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[var(--accent-primary)] resize-none"
          />
        </div>

        {error && (
          <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full min-h-[46px] px-4 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>Сохраняем...</span>
            </>
          ) : savedToast ? (
            <>
              <Check className="w-4 h-4" aria-hidden="true" />
              <span>Профиль сохранён</span>
            </>
          ) : (
            <span>Сохранить профиль</span>
          )}
        </button>
      </form>
    </div>
  );
}
