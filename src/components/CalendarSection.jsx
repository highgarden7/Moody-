import { useMemo, useState } from 'react';
import { CONDITIONS, conditionByKey } from '../conditions';
import { addEvent, editEvent, eventsForDate, removeEvent, saveMood } from '../hooks/useCoupleData';
import {
  addDays,
  addMonths,
  buildMonthGrid,
  buildWeekDays,
  formatEventRange,
  formatMonthLabel,
  fromDateTimeLocalValue,
  isSameDay,
  isSameMonth,
  toDateInputValue,
  toDateTimeLocalValue,
} from '../lib/date';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const WARM_KEYS = new Set(['spark', 'warm', 'miss', 'good']);
const CELL_BASE = '#EFEAE0';

export default function CalendarSection({
  coupleId,
  currentUser,
  events,
  moods,
  ownerColors,
  toast,
}) {
  const [viewMode, setViewMode] = useState('week');
  const [cursorDate, setCursorDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [editingEventId, setEditingEventId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [eventForm, setEventForm] = useState(makeDefaultEventForm(new Date(), currentUser.uid));
  const [showMoodForm, setShowMoodForm] = useState(false);
  const [moodForm, setMoodForm] = useState({ condition: 'good', note: '' });
  const [moodBusy, setMoodBusy] = useState(false);

  const visibleDays = useMemo(
    () => (viewMode === 'month' ? buildMonthGrid(cursorDate) : buildWeekDays(cursorDate)),
    [cursorDate, viewMode]
  );

  const selectedDayEvents = useMemo(
    () => eventsForDate(events, selectedDate).sort((left, right) => left.startDate - right.startDate),
    [events, selectedDate]
  );

  const myUid = currentUser.uid;
  const partnerUid = Object.keys(ownerColors).find((uid) => uid !== myUid) ?? null;

  const selectedDateKey = toDateInputValue(selectedDate);
  const selectedDayMoods = moods[selectedDateKey] || {};
  const myMood = selectedDayMoods[myUid];

  const monthlySummary = useMemo(() => {
    if (!partnerUid) return null;
    let warmDays = 0;
    let crossedDays = 0;
    const year = cursorDate.getFullYear();
    const month = cursorDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = toDateInputValue(new Date(year, month, d));
      const dayData = moods[dateKey];
      if (!dayData) continue;
      const myEntry = dayData[myUid];
      const partnerEntry = dayData[partnerUid];
      if (!myEntry?.condition || !partnerEntry?.condition) continue;
      const myWarm = WARM_KEYS.has(myEntry.condition);
      const partnerWarm = WARM_KEYS.has(partnerEntry.condition);
      if (myWarm && partnerWarm) warmDays++;
      else if (myWarm !== partnerWarm) crossedDays++;
    }
    return { warmDays, crossedDays };
  }, [moods, cursorDate, myUid, partnerUid]);

  function handleMove(direction) {
    setCursorDate((current) =>
      viewMode === 'month' ? addMonths(current, direction) : addDays(current, direction * 7)
    );
  }

  function handleSelectDate(date) {
    setSelectedDate(date);
    setEventForm(makeDefaultEventForm(date, currentUser.uid));
    setEditingEventId(null);
    setShowForm(false);
    setShowMoodForm(false);
  }

  function openMoodForm() {
    setMoodForm({
      condition: myMood?.condition || 'good',
      note: myMood?.note || ''
    });
    setShowMoodForm(true);
  }

  async function handleSaveMood(event) {
    event.preventDefault();
    setMoodBusy(true);

    try {
      await saveMood(coupleId, currentUser.uid, selectedDateKey, moodForm);
      toast('컨디션을 저장했어.');
      setShowMoodForm(false);
    } catch (error) {
      toast(error.message || '컨디션 저장에 실패했어.');
    } finally {
      setMoodBusy(false);
    }
  }

  function openCreateForm() {
    setEditingEventId(null);
    setEventForm(makeDefaultEventForm(selectedDate, currentUser.uid));
    setShowForm(true);
  }

  function openEditForm(item) {
    setEditingEventId(item.id);
    setEventForm({
      title: item.title,
      ownerUid: item.ownerUid,
      allDay: item.allDay,
      startDate: toDateInputValue(item.startDate),
      endDate: toDateInputValue(item.endDate),
      startAt: toDateTimeLocalValue(item.startDate),
      endAt: toDateTimeLocalValue(item.endDate),
    });
    setShowForm(true);
  }

  async function handleSaveEvent(event) {
    event.preventDefault();
    setBusy(true);

    try {
      const start = eventForm.allDay
        ? new Date(`${eventForm.startDate}T00:00:00`)
        : fromDateTimeLocalValue(eventForm.startAt);
      const end = eventForm.allDay
        ? new Date(`${eventForm.endDate}T23:59:00`)
        : fromDateTimeLocalValue(eventForm.endAt);

      if (end < start) {
        throw new Error('종료 시간이 시작보다 빠를 수는 없어.');
      }

      const payload = {
        title: eventForm.title.trim(),
        start,
        end,
        allDay: eventForm.allDay,
        ownerUid: eventForm.ownerUid,
      };

      if (editingEventId) {
        await editEvent(coupleId, editingEventId, payload);
        toast('일정을 수정했어.');
      } else {
        await addEvent(coupleId, payload);
        toast('일정을 추가했어.');
      }

      setEventForm(makeDefaultEventForm(selectedDate, currentUser.uid));
      setEditingEventId(null);
      setShowForm(false);
    } catch (error) {
      toast(error.message || '일정 저장에 실패했어.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteEvent(eventId) {
    setBusy(true);

    try {
      await removeEvent(coupleId, eventId);
      setEditingEventId(null);
      setShowForm(false);
      setEventForm(makeDefaultEventForm(selectedDate, currentUser.uid));
      toast('일정을 삭제했어.');
    } catch (error) {
      toast(error.message || '일정 삭제에 실패했어.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="tab-panel">
      <header className="calendar-head">
        <div className="calendar-head-row">
          <button className="icon-btn" onClick={() => handleMove(-1)} type="button" aria-label="이전">
            ‹
          </button>
          <h2 className="calendar-title">{formatMonthLabel(cursorDate)}</h2>
          <button className="icon-btn" onClick={() => handleMove(1)} type="button" aria-label="다음">
            ›
          </button>
          <div className="calendar-head-actions">
            <button className="btn-ghost" onClick={() => setCursorDate(new Date())} type="button">
              오늘
            </button>
            <div className="segmented">
              <button
                className={viewMode === 'month' ? 'active' : ''}
                onClick={() => setViewMode('month')}
                type="button"
              >
                월
              </button>
              <button
                className={viewMode === 'week' ? 'active' : ''}
                onClick={() => setViewMode('week')}
                type="button"
              >
                주
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="panel paper-card calendar-paper">
        {viewMode === 'month' ? (
          <>
            <div className="weekday-row">
              {WEEKDAY_LABELS.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <div className="month-grid refined">
              {visibleDays.map((date) => {
                const dateKey = toDateInputValue(date);
                const dayMoodData = moods[dateKey] || {};
                const dayEvents = eventsForDate(events, date);
                const isToday = isSameDay(date, new Date());
                const isSelected = isSameDay(date, selectedDate);
                const inMonth = isSameMonth(date, cursorDate);

                const myCondKey = dayMoodData[myUid]?.condition;
                const partnerCondKey = partnerUid ? dayMoodData[partnerUid]?.condition : null;
                const myColor = myCondKey ? (conditionByKey(myCondKey)?.color ?? CELL_BASE) : CELL_BASE;
                const partnerColor = partnerCondKey
                  ? (conditionByKey(partnerCondKey)?.color ?? CELL_BASE)
                  : CELL_BASE;

                const dayEventOwners = [...new Set(dayEvents.map((e) => e.ownerUid))].slice(0, 2);

                return (
                  <button
                    className={[
                      'calendar-date-cell',
                      'heatmap-cell',
                      isToday ? 'ring-today' : '',
                      isSelected ? 'ring-selected' : '',
                      inMonth ? '' : 'outside',
                    ].filter(Boolean).join(' ')}
                    key={date.toISOString()}
                    onClick={() => handleSelectDate(date)}
                    style={{
                      background: `linear-gradient(135deg, ${myColor} 0% 50%, ${partnerColor} 50% 100%)`
                    }}
                    type="button"
                  >
                    <span className="date-chip">{date.getDate()}</span>
                    {dayEventOwners.length > 0 && (
                      <span className="cell-dots-bottom">
                        {dayEventOwners.map((uid) => (
                          <span
                            className="event-dot"
                            key={uid}
                            style={{ backgroundColor: ownerColors[uid] || '#d08b2f' }}
                          />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {monthlySummary && (monthlySummary.warmDays > 0 || monthlySummary.crossedDays > 0) && (
              <p className="month-summary-line">
                이번 달 둘 다 따뜻한 날 {monthlySummary.warmDays} · 엇갈린 날 {monthlySummary.crossedDays}
              </p>
            )}
          </>
        ) : (
          <div className="week-strip refined">
            {visibleDays.map((date) => {
              const dayEvents = eventsForDate(events, date);
              const dayMoods = Object.keys(moods[toDateInputValue(date)] || {}).slice(0, 2);
              const isToday = isSameDay(date, new Date());
              const isSelected = isSameDay(date, selectedDate);

              return (
                <button
                  className={['week-compact-cell', isSelected ? 'selected' : ''].join(' ')}
                  key={date.toISOString()}
                  onClick={() => handleSelectDate(date)}
                  type="button"
                >
                  <span className="compact-weekday">{WEEKDAY_LABELS[date.getDay()]}</span>
                  <span className={isToday ? 'date-badge today' : 'date-badge'}>{date.getDate()}</span>
                  <span className="cell-dots">
                    {dayEvents.length > 0 ? <span className="event-marker" /> : null}
                    {dayMoods.map((uid) => (
                      <span
                        className="mood-marker"
                        key={uid}
                        style={{ backgroundColor: ownerColors[uid] || 'var(--text-mute)' }}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="note note-yellow tilt-left calendar-note">
        <div className="summary-row">
          <h3>{formatSelectedDate(selectedDate)}</h3>
        </div>
        {Object.entries(selectedDayMoods).length === 0 ? (
          <p>아직 남긴 컨디션이 없어.</p>
        ) : (
          <div className="mood-note-list">
            {Object.entries(selectedDayMoods).map(([uid, item]) => {
              const cond = conditionByKey(item.condition);
              const moodTag = cond
                ? `${cond.emoji} ${cond.label}`
                : (item.emoji || '');
              return (
                <p key={uid}>
                  <span
                    className="inline-dot"
                    style={{ backgroundColor: ownerColors[uid] || 'var(--text-mute)' }}
                  />
                  {uid === currentUser.uid ? '나' : '상대'}
                  {moodTag ? ` ${moodTag}` : ''}
                  {item.note ? ` ${item.note}` : ''}
                </p>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel paper-card">
        <div className="summary-row summary-row-spread">
          <h3>컨디션</h3>
          {showMoodForm ? (
            <button className="btn-secondary" onClick={() => setShowMoodForm(false)} type="button">
              닫기
            </button>
          ) : (
            <button className="btn-secondary" onClick={openMoodForm} type="button">
              {myMood ? '컨디션 수정' : '+ 컨디션 추가'}
            </button>
          )}
        </div>

        {showMoodForm ? (
          <>
            <div className="condition-grid">
              {CONDITIONS.map((cond) => {
                const isSelected = moodForm.condition === cond.key;
                return (
                  <button
                    className={['condition-tile', isSelected ? 'selected' : ''].join(' ')}
                    key={cond.key}
                    onClick={() => setMoodForm((c) => ({ ...c, condition: cond.key }))}
                    style={{
                      backgroundColor: cond.color + (isSelected ? '44' : '1a'),
                      borderColor: isSelected ? cond.color : 'transparent',
                    }}
                    type="button"
                  >
                    <span className="condition-emoji">{cond.emoji}</span>
                    <span className="condition-label">{cond.label}</span>
                    <span className="condition-cue">{cond.cue}</span>
                  </button>
                );
              })}
            </div>

            <form className="stack mood-form" onSubmit={handleSaveMood}>
              <label className="field">
                <span>짧은 메모</span>
                <textarea
                  maxLength={80}
                  onChange={(event) => setMoodForm((current) => ({ ...current, note: event.target.value }))}
                  placeholder="오늘은 좀 지침, 퇴근 뒤엔 괜찮을 듯"
                  rows={3}
                  value={moodForm.note}
                />
              </label>
              <button className="btn-primary" disabled={moodBusy} type="submit">
                저장
              </button>
            </form>
          </>
        ) : null}
      </section>

      <section className="panel paper-card">
        <div className="summary-row summary-row-spread">
          <h3>일정</h3>
          {showForm ? (
            <button className="btn-secondary" onClick={() => setShowForm(false)} type="button">
              닫기
            </button>
          ) : (
            <button className="btn-secondary" onClick={openCreateForm} type="button">
              + 일정 추가
            </button>
          )}
        </div>
        <div className="event-list compact">
          {selectedDayEvents.length === 0 ? (
            <div className="event-empty">
              <p className="muted">아직 일정 없음</p>
              {!showForm ? (
                <button className="btn-secondary" onClick={openCreateForm} type="button">
                  + 일정 추가
                </button>
              ) : null}
            </div>
          ) : (
            selectedDayEvents.map((item) => (
              <article className="event-row" key={item.id}>
                <div className="event-row-main">
                  <span
                    className="owner-dot"
                    style={{ backgroundColor: ownerColors[item.ownerUid] || 'var(--text-mute)' }}
                  />
                  <div>
                    <strong>{item.title}</strong>
                    <p className="muted">{formatEventRange(item.startDate, item.endDate, item.allDay)}</p>
                  </div>
                </div>
                <button className="btn-secondary" onClick={() => openEditForm(item)} type="button">
                  보기
                </button>
              </article>
            ))
          )}
        </div>
      </section>

      {showForm ? (
        <section className="panel paper-card">
          <div className="summary-row">
            <h3>{editingEventId ? '일정 수정' : '새 일정'}</h3>
          </div>

          <form className="stack" onSubmit={handleSaveEvent}>
            <label className="field">
              <span>제목</span>
              <input
                onChange={(event) => setEventForm((current) => ({ ...current, title: event.target.value }))}
                required
                value={eventForm.title}
              />
            </label>

            <label className="inline-checkbox">
              <input
                checked={eventForm.allDay}
                onChange={(event) =>
                  setEventForm((current) => ({ ...current, allDay: event.target.checked }))
                }
                type="checkbox"
              />
              <span>하루 종일</span>
            </label>

            <label className="field">
              <span>작성자</span>
              <select
                onChange={(event) => setEventForm((current) => ({ ...current, ownerUid: event.target.value }))}
                value={eventForm.ownerUid}
              >
                {Object.keys(ownerColors).map((uid) => (
                  <option key={uid} value={uid}>
                    {uid === currentUser.uid ? '나' : '상대'}
                  </option>
                ))}
              </select>
            </label>

            {eventForm.allDay ? (
              <>
                <label className="field">
                  <span>시작일</span>
                  <input
                    onChange={(event) =>
                      setEventForm((current) => ({ ...current, startDate: event.target.value }))
                    }
                    required
                    type="date"
                    value={eventForm.startDate}
                  />
                </label>
                <label className="field">
                  <span>종료일</span>
                  <input
                    onChange={(event) =>
                      setEventForm((current) => ({ ...current, endDate: event.target.value }))
                    }
                    required
                    type="date"
                    value={eventForm.endDate}
                  />
                </label>
              </>
            ) : (
              <>
                <label className="field">
                  <span>시작</span>
                  <input
                    onChange={(event) =>
                      setEventForm((current) => ({ ...current, startAt: event.target.value }))
                    }
                    required
                    type="datetime-local"
                    value={eventForm.startAt}
                  />
                </label>
                <label className="field">
                  <span>종료</span>
                  <input
                    onChange={(event) =>
                      setEventForm((current) => ({ ...current, endAt: event.target.value }))
                    }
                    required
                    type="datetime-local"
                    value={eventForm.endAt}
                  />
                </label>
              </>
            )}

            <button className="btn-primary" disabled={busy} type="submit">
              {editingEventId ? '수정 저장' : '+ 일정 추가'}
            </button>

            {editingEventId ? (
              <button
                className="btn-danger-soft"
                disabled={busy}
                onClick={() => handleDeleteEvent(editingEventId)}
                type="button"
              >
                일정 삭제
              </button>
            ) : null}
          </form>
        </section>
      ) : null}
    </section>
  );
}

function makeDefaultEventForm(date, ownerUid) {
  const end = new Date(date);
  end.setHours(end.getHours() + 1);

  return {
    title: '',
    ownerUid,
    allDay: true,
    startDate: toDateInputValue(date),
    endDate: toDateInputValue(date),
    startAt: toDateTimeLocalValue(date),
    endAt: toDateTimeLocalValue(end),
  };
}

function formatSelectedDate(date) {
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAY_LABELS[date.getDay()]})`;
}
