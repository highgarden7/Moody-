import { useEffect, useMemo, useState } from 'react';
import { saveMood } from '../hooks/useCoupleData';
import { buildWeekDays, formatDateKey } from '../lib/date';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const MOOD_OPTIONS = [
  { emoji: '😀', label: '좋음' },
  { emoji: '🥰', label: '설렘' },
  { emoji: '😮‍💨', label: '기빨림' },
  { emoji: '😵', label: '과부하' },
  { emoji: '😴', label: '졸림' },
  { emoji: '🔥', label: '의욕' },
  { emoji: '🤯', label: '야근각' },
  { emoji: '🌧️', label: '다운' }
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
      toast('컨디션을 저장했어.');
    } catch (error) {
      toast(error.message || '컨디션 저장에 실패했어.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="tab-panel">
      <section className="note note-yellow tilt-right">
        <div className="hero-line">
          <strong className="hero-emoji">{myMood?.emoji || form.emoji}</strong>
          <div>
            <h3>{formatSelectedDate(selectedDate)}</h3>
            <p>{myMood?.note || '아직 메모 없음'}</p>
          </div>
        </div>
      </section>

      <section className="panel paper-card">
        <div className="week-strip refined">
          {weekDays.map((date) => (
            <button
              className={['week-compact-cell', formatDateKey(date) === dateKey ? 'selected' : ''].join(' ')}
              key={date.toISOString()}
              onClick={() => setSelectedDate(date)}
              type="button"
            >
              <span className="compact-weekday">{WEEKDAY_LABELS[date.getDay()]}</span>
              <span className="date-badge">{date.getDate()}</span>
              <span className="cell-dots">
                {Object.keys(moods[formatDateKey(date)] || {})
                  .slice(0, 2)
                  .map((uid) => (
                    <span
                      className="mood-marker"
                      key={uid}
                      style={{ backgroundColor: ownerColors[uid] || 'var(--text-mute)' }}
                    />
                  ))}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel paper-card">
        <div className="mood-grid">
          {MOOD_OPTIONS.map((option) => (
            <button
              className={['mood-option', form.emoji === option.emoji ? 'selected' : ''].join(' ')}
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
            <span>짧은 메모</span>
            <textarea
              maxLength={80}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
              placeholder="오늘은 좀 지침, 퇴근 뒤엔 괜찮을 듯"
              rows={3}
              value={form.note}
            />
          </label>
          <button className="btn-primary" disabled={busy} type="submit">
            저장
          </button>
        </form>
      </section>

      <section className="panel paper-card">
        <div className="shared-moods">
          {Object.entries(dayMoods).length === 0 ? (
            <EmptyState label="아직 아무도 컨디션을 남기지 않았어." />
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

function formatSelectedDate(date) {
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAY_LABELS[date.getDay()]})`;
}

function EmptyState({ label }) {
  return (
    <div className="empty-state">
      <img className="empty-state-icon" src="/files/app-icon.svg" alt="" aria-hidden="true" />
      <p className="muted">{label}</p>
    </div>
  );
}
