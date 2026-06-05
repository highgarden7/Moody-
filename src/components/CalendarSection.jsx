import { useMemo, useState } from 'react';
import {
  addEvent,
  editEvent,
  eventsForDate,
  removeEvent,
} from '../hooks/useCoupleData';
import {
  addDays,
  addMonths,
  buildMonthGrid,
  buildWeekDays,
  formatDateKey,
  formatDayLabel,
  formatEventDateTime,
  formatMonthLabel,
  fromDateTimeLocalValue,
  isSameDay,
  isSameMonth,
  toDateInputValue,
  toDateTimeLocalValue,
} from '../lib/date';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

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

  const visibleDays = useMemo(
    () => (viewMode === 'month' ? buildMonthGrid(cursorDate) : buildWeekDays(cursorDate)),
    [cursorDate, viewMode]
  );

  const selectedDayEvents = useMemo(
    () => eventsForDate(events, selectedDate).sort((left, right) => left.startDate - right.startDate),
    [events, selectedDate]
  );

  const selectedDayMoods = moods[formatDateKey(selectedDate)] || {};

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
      <header className="section-head">
        <div>
          <p className="eyebrow">Calendar</p>
          <h2>{formatMonthLabel(cursorDate)}</h2>
        </div>
        <div className="header-actions">
          <div className="segmented">
            <button
              className={viewMode === 'week' ? 'active' : ''}
              onClick={() => setViewMode('week')}
              type="button"
            >
              주
            </button>
            <button
              className={viewMode === 'month' ? 'active' : ''}
              onClick={() => setViewMode('month')}
              type="button"
            >
              월
            </button>
          </div>
        </div>
      </header>

      <section className="panel">
        <div className="calendar-toolbar">
          <button className="outline-button" onClick={() => handleMove(-1)} type="button">
            이전
          </button>
          <button className="soft-button" onClick={() => setCursorDate(new Date())} type="button">
            오늘
          </button>
          <button className="outline-button" onClick={() => handleMove(1)} type="button">
            다음
          </button>
        </div>

        <div className={viewMode === 'week' ? 'week-strip' : 'month-grid'}>
          {visibleDays.map((date) => {
            const dayEvents = eventsForDate(events, date);
            const dayMoodIcons = Object.values(moods[formatDateKey(date)] || {})
              .filter(Boolean)
              .slice(0, 2)
              .map((item) => item.emoji)
              .join(' ');
            const isToday = isSameDay(date, new Date());
            const isSelected = isSameDay(date, selectedDate);
            const inMonth = isSameMonth(date, cursorDate);

            return (
              <button
                className={[
                  viewMode === 'week' ? 'week-day' : 'month-day',
                  isToday ? 'today' : '',
                  isSelected ? 'selected' : '',
                  inMonth ? '' : 'outside',
                ].join(' ')}
                key={date.toISOString()}
                onClick={() => handleSelectDate(date)}
                type="button"
              >
                <span className="weekday-label">{WEEKDAY_LABELS[date.getDay()]}</span>
                <span className="date-number">{date.getDate()}</span>
                <span className="mini-meta">{dayMoodIcons || '\u00A0'}</span>
                <span className="mini-count">
                  {dayEvents.length > 0 ? `${dayEvents.length}개` : ''}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel selected-summary">
        <div className="summary-row">
          <div>
            <p className="eyebrow">Selected Day</p>
            <h3>{formatDateKey(selectedDate)}</h3>
          </div>
          <button className="primary-button" onClick={openCreateForm} type="button">
            일정 추가
          </button>
        </div>

        <div className="mood-inline">
          {Object.entries(selectedDayMoods).map(([uid, item]) => (
            <div className="flat-chip" key={uid}>
              <span
                className="owner-dot"
                style={{ backgroundColor: ownerColors[uid] || 'var(--text-mute)' }}
              />
              <span>{uid === currentUser.uid ? '나' : '상대'}</span>
              <strong>{item.emoji}</strong>
            </div>
          ))}
          {Object.keys(selectedDayMoods).length === 0 ? (
            <p className="muted">아직 컨디션 기록 없음</p>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="summary-row">
          <div>
            <p className="eyebrow">Events</p>
            <h3>이 날 일정</h3>
          </div>
        </div>

        <div className="event-list compact">
          {selectedDayEvents.length === 0 ? (
            <p className="muted">등록된 일정 없음</p>
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
                    <p className="muted">{formatEventDateTime(item.startDate, item.allDay)}</p>
                  </div>
                </div>
                <button className="soft-button" onClick={() => openEditForm(item)} type="button">
                  보기
                </button>
              </article>
            ))
          )}
        </div>
      </section>

      {showForm ? (
        <section className="panel">
          <div className="summary-row">
            <div>
              <p className="eyebrow">Event Form</p>
              <h3>{editingEventId ? '일정 수정' : '새 일정'}</h3>
            </div>
            <button className="outline-button" onClick={() => setShowForm(false)} type="button">
              닫기
            </button>
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

            <button className="primary-button" disabled={busy} type="submit">
              {editingEventId ? '수정 저장' : '일정 저장'}
            </button>

            {editingEventId ? (
              <button
                className="danger-button"
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
