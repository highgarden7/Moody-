import { useMemo, useState } from 'react';
import { removeDday, saveDday } from '../hooks/useCoupleData';
import { buildDdayItems } from '../lib/dday';
import { toDateInputValue } from '../lib/date';

export default function DdaySection({ anniversary, coupleId, ddays, toast }) {
  const [form, setForm] = useState({
    label: '',
    date: toDateInputValue(new Date()),
    repeatEvery: 'none',
  });
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);

  const items = useMemo(() => buildDdayItems(anniversary, ddays), [anniversary, ddays]);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);

    try {
      await saveDday(
        coupleId,
        {
          label: form.label.trim(),
          date: new Date(`${form.date}T00:00:00`),
          repeatEvery: form.repeatEvery,
        },
        editingId
      );
      setForm({
        label: '',
        date: toDateInputValue(new Date()),
        repeatEvery: 'none',
      });
      setEditingId(null);
      toast(editingId ? 'D-day 수정 완료.' : 'D-day 추가 완료.');
    } catch (error) {
      toast(error.message || 'D-day 저장 실패.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(ddayId) {
    setBusy(true);

    try {
      await removeDday(coupleId, ddayId);
      toast('D-day 삭제 완료.');
    } catch (error) {
      toast(error.message || 'D-day 삭제 실패.');
    } finally {
      setBusy(false);
    }
  }

  function handleEdit(item) {
    const date = item.date.toDate ? item.date.toDate() : item.date;
    setEditingId(item.id);
    setForm({
      label: item.label,
      date: toDateInputValue(date),
      repeatEvery: item.repeatEvery,
    });
  }

  return (
    <section className="tab-panel">
      <header className="section-head">
        <div>
          <p className="eyebrow">D-Day</p>
          <h2>기념일 카운터</h2>
        </div>
      </header>

      <div className="note-stack">
        {items.slice(0, 2).map((item, index) => (
          <article
            className={`note ${index % 2 === 0 ? 'note-yellow' : 'note-peach'} ${index % 2 === 0 ? 'tilt-left' : 'tilt-right'}`}
            key={item.id}
          >
            <span className="counter">{item.counter}</span>
            <strong>{item.label}</strong>
            <p>{item.subtitle}</p>
          </article>
        ))}
      </div>

      <section className="panel">
        <p className="eyebrow">All Counters</p>
        <div className="dday-list">
          {items.map((item) => (
            <article className="dday-row" key={item.id}>
              <div>
                <strong>{item.label}</strong>
                <p className="muted">{item.subtitle}</p>
              </div>
              <span className="counter-inline">{item.counter}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="summary-row">
          <div>
            <p className="eyebrow">Manage</p>
            <h3>{editingId ? '카운터 수정' : '카운터 추가'}</h3>
          </div>
        </div>

        <form className="stack" onSubmit={handleSubmit}>
          <label className="field">
            <span>라벨</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
              required
              value={form.label}
            />
          </label>

          <label className="field">
            <span>날짜</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              required
              type="date"
              value={form.date}
            />
          </label>

          <label className="field">
            <span>반복</span>
            <select
              onChange={(event) =>
                setForm((current) => ({ ...current, repeatEvery: event.target.value }))
              }
              value={form.repeatEvery}
            >
              <option value="none">반복 없음</option>
              <option value="100days">100일 단위</option>
            </select>
          </label>

          <button className="primary-button" disabled={busy} type="submit">
            {editingId ? '수정 저장' : '추가'}
          </button>
        </form>

        <div className="event-list compact">
          {ddays.map((item) => (
            <article className="event-row" key={item.id}>
              <div className="event-row-main">
                <div>
                  <strong>{item.label}</strong>
                  <p className="muted">{item.repeatEvery === '100days' ? '100일 반복' : '고정 날짜'}</p>
                </div>
              </div>
              <div className="row-actions">
                <button className="soft-button" onClick={() => handleEdit(item)} type="button">
                  수정
                </button>
                <button className="danger-button inline" onClick={() => handleDelete(item.id)} type="button">
                  삭제
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
