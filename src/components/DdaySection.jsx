import { useMemo, useState } from 'react';
import { removeDday, saveDday } from '../hooks/useCoupleData';
import { buildDdayItems } from '../lib/dday';
import { toDateInputValue } from '../lib/date';

export default function DdaySection({ anniversary, coupleId, ddays, toast }) {
  const [form, setForm] = useState({
    label: '',
    date: toDateInputValue(new Date()),
    repeatEvery: 'none'
  });
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const items = useMemo(() => buildDdayItems(anniversary, ddays), [anniversary, ddays]);

  function resetForm() {
    setEditingId(null);
    setForm({
      label: '',
      date: toDateInputValue(new Date()),
      repeatEvery: 'none'
    });
  }

  function closeForm() {
    resetForm();
    setShowForm(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);

    try {
      await saveDday(
        coupleId,
        {
          label: form.label.trim(),
          date: new Date(`${form.date}T00:00:00`),
          repeatEvery: form.repeatEvery
        },
        editingId
      );
      resetForm();
      setShowForm(false);
      toast(editingId ? 'D-day를 수정했어.' : 'D-day를 추가했어.');
    } catch (error) {
      toast(error.message || 'D-day 저장에 실패했어.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(ddayId) {
    setBusy(true);

    try {
      await removeDday(coupleId, ddayId);
      if (editingId === ddayId) {
        closeForm();
      }
      toast('D-day를 삭제했어.');
    } catch (error) {
      toast(error.message || 'D-day 삭제에 실패했어.');
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
      repeatEvery: item.repeatEvery
    });
    setShowForm(true);
  }

  return (
    <section className="tab-panel">
      <div className="note-stack">
        {items.map((item, index) => (
          <article
            className={`note ${index % 2 === 0 ? 'note-yellow tilt-left' : 'note-peach tilt-right'}`}
            key={item.id}
          >
            <span className="counter">{item.counter}</span>
            <strong>{item.label}</strong>
            <p>{item.subtitle}</p>
            {item.isCustom ? (
              <div className="note-actions">
                <button
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => handleEdit(item.originalItem)}
                  type="button"
                >
                  수정
                </button>
                <button
                  className="btn-danger-soft"
                  disabled={busy}
                  onClick={() => handleDelete(item.id)}
                  type="button"
                >
                  삭제
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <section className="panel paper-card">
        <div className="summary-row summary-row-spread">
          <h3>{editingId ? '카운터 수정' : '카운터 추가'}</h3>
          {showForm ? (
            <button className="btn-secondary" onClick={closeForm} type="button">
              닫기
            </button>
          ) : (
            <button className="btn-secondary" onClick={() => setShowForm(true)} type="button">
              + 카운터 추가
            </button>
          )}
        </div>

        {showForm ? (
          <form className="stack" onSubmit={handleSubmit}>
            <label className="field">
              <span>이름</span>
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
                <option value="yearly">매년</option>
              </select>
            </label>

            <button className="btn-primary" disabled={busy} type="submit">
              {editingId ? '수정 완료' : '+ 추가하기'}
            </button>
          </form>
        ) : null}
      </section>
    </section>
  );
}
