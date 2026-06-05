export const DAY_MS = 24 * 60 * 60 * 1000;

export function pad(value) {
  return String(value).padStart(2, '0');
}

export function formatDateKey(date) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfWeek(date) {
  const copy = startOfDay(date);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day);
  return copy;
}

export function endOfWeek(date) {
  const copy = startOfWeek(date);
  copy.setDate(copy.getDate() + 6);
  return copy;
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function datesBetween(start, end) {
  const dates = [];
  let cursor = startOfDay(start);
  const last = startOfDay(end);

  while (cursor <= last) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return dates;
}

export function buildMonthGrid(currentMonth) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);
  return datesBetween(gridStart, gridEnd);
}

export function buildWeekDays(currentDate) {
  const start = startOfWeek(currentDate);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function isSameDay(left, right) {
  return formatDateKey(left) === formatDateKey(right);
}

export function isSameMonth(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  );
}

export function formatMonthLabel(date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

export function formatDayLabel(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatFullDate(date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export function formatEventDateTime(date, allDay) {
  if (allDay) {
    return formatDateKey(date);
  }

  return `${formatDateKey(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toDateTimeLocalValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function fromDateTimeLocalValue(value) {
  return new Date(value);
}

export function toDateInputValue(date) {
  return formatDateKey(date);
}

export function fromDateInputValue(value) {
  return parseDateKey(value);
}

export function diffInDays(targetDate, baseDate = new Date()) {
  const target = startOfDay(targetDate);
  const base = startOfDay(baseDate);
  return Math.round((target.getTime() - base.getTime()) / DAY_MS);
}

export function daysSince(startDate, baseDate = new Date()) {
  const start = startOfDay(startDate);
  const base = startOfDay(baseDate);
  return Math.floor((base.getTime() - start.getTime()) / DAY_MS) + 1;
}
