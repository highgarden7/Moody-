import { useEffect, useMemo, useState } from 'react';
import { saveMood } from '../hooks/useCoupleData';
import { buildWeekDays, formatDateKey } from '../lib/date';

const MOOD_OPTIONS = [
  { emoji: '😀', label: '좋음' },
  { emoji: '🥰', label: '설렘' },
  { emoji: '😮‍💨', label: '기빨림' },
  { emoji: '😵', label: '야근각' },
  { emoji: '😴', label: '졸림' },
  { emoji: '🔥', label: '의욕' },
  { emoji: '🤯', label: '과부하' },
  { emoji: '🌧️', label: '다운' },
];

export default function MoodSection({ coupleId, currentUser, moods, ownerColors, toast }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [form, setForm] = useState({ emoji: '😀', note: '' });
  const [busy, setBusy] = useState(false);

  const weekDays = useMemo(() => buildWeekDays(selectedDate), [selectedDate]);
  const dateKey = formatDateKey(selectedDate);
  const dayMoods = moods[dateKey] || {};
  const myMood = dayMoods[currentUser.uid];

  useEffect(() => {
    setForm(myMood || { emoji: '😀', note: '' });
  }, [myMood, dateKey]);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);

    try {
      await saveMood(coupleId, currentUser.uid, dateKey, form);
      toast('컨디션 저장했어.');
    } catch (error) {
      toast(error.message || '컨디션 저장 실패.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="tab-panel">
      <header className="section-head">
        <div>
          <p className="eyebrow">Mood</p>
          <h2>그날 컨디션</h2>
        </div>
      </header>

      <section className="note note-yellow">
        <p className="eyebrow note-eyebrow">Today</p>
        <div className="hero-line">
          <strong className="hero-emoji">{myMood?.emoji || form.emoji}</strong>
          <div>
            <h3>{formatDateKey(selectedDate)}</h3>
            <p>{myMood?.note || '아직 메모 없음'}</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Quick Pick</p>
        <div className="week-strip mood-strip">
          {weekDays.map((date) => (
            <button
              className={[
                'week-day mood-day',
                formatDateKey(date) === dateKey ? 'selected' : '',
              ].join(' ')}
              key={date.toISOString()}
              onClick={() => setSelectedDate(date)}
              type="button"
            >
              <span className="weekday-label">{['일', '월', '화', '수', '목', '금', '토'][date.getDay()]}</span>
              <span className="date-number">{date.getDate()}</span>
              <span className="mini-meta">
                {Object.values(moods[formatDateKey(date)] || {})
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((item) => item.emoji)
                  .join(' ') || '\u00A0'}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Status</p>
        <div className="mood-grid">
          {MOOD_OPTIONS.map((option) => (
            <button
              className={[
                'mood-option',
                form.emoji === option.emoji ? 'selected' : '',
              ].join(' ')}
              key={option.emoji}
              onClick={() => setForm((current) => ({ ...current, emoji: option.emoji }))}
              type="button"
            >
              <span>{option.emoji}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>

        <form className="stack mood-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>한 줄 메모</span>
            <textarea
              maxLength={80}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
              placeholder="오늘은 야근, 답장 늦을 수 있음"
              rows={3}
              value={form.note}
            />
          </label>
          <button className="primary-button" disabled={busy} type="submit">
            저장
          </button>
        </form>
      </section>

      <section className="panel">
        <p className="eyebrow">Shared</p>
        <div className="shared-moods">
          {Object.entries(dayMoods).length === 0 ? (
            <p className="muted">아직 아무도 기록 안 했어.</p>
          ) : (
            Object.entries(dayMoods).map(([uid, item]) => (
              <article className="share-row" key={uid}>
                <div className="event-row-main">
                  <span
                    className="owner-dot"
                    style={{ backgroundColor: ownerColors[uid] || 'var(--text-mute)' }}
                  />
                  <div>
                    <strong>{uid === currentUser.uid ? '나' : '상대'}</strong>
                    <p className="muted">{item.note || '메모 없음'}</p>
                  </div>
                </div>
                <strong>{item.emoji}</strong>
              </article>
            ))
          )}
        </div>
      </section>
    </section>
  );
}
