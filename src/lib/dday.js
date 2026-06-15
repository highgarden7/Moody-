import { diffInDays, daysSince, formatFullDate, startOfDay } from './date';

export function buildDdayItems(anniversary, ddays) {
  const items = [];

  if (anniversary) {
    const metDate = anniversary.toDate ? anniversary.toDate() : anniversary;
    const togetherDays = daysSince(metDate);
    const nextMilestone = Math.ceil(togetherDays / 100) * 100;
    const nextMilestoneDate = new Date(startOfDay(metDate));
    nextMilestoneDate.setDate(nextMilestoneDate.getDate() + (nextMilestone - 1));

    items.push({
      id: 'anniversary-start',
      label: '만난 날',
      subtitle: `${formatFullDate(metDate)}부터 ${togetherDays}일째`,
      counter: `D+${togetherDays - 1}`,
      targetDate: metDate,
      isCustom: false
    });
    items.push({
      id: 'anniversary-next-100',
      label: `${nextMilestone}일`,
      subtitle: formatFullDate(nextMilestoneDate),
      counter: formatCounter(nextMilestoneDate),
      targetDate: nextMilestoneDate,
      isCustom: false
    });
  }

  ddays.forEach((item) => {
    const targetDate = item.date.toDate ? item.date.toDate() : item.date;
    let label = item.label;

    if (item.repeatEvery === '100days') {
      const start = startOfDay(targetDate);
      const passed = Math.max(0, daysSince(start) - 1);
      const currentCycle = Math.floor(passed / 100) + 1;
      const nextCycleDate = new Date(start);
      nextCycleDate.setDate(nextCycleDate.getDate() + currentCycle * 100);
      label = `${item.label} ${currentCycle * 100}일`;

      items.push({
        id: item.id,
        label,
        subtitle: formatFullDate(nextCycleDate),
        counter: formatCounter(nextCycleDate),
        targetDate: nextCycleDate,
        isCustom: true,
        originalItem: item
      });
      return;
    }

    if (item.repeatEvery === 'yearly') {
      const nextYearlyDate = getNextYearlyDate(targetDate);

      items.push({
        id: item.id,
        label,
        subtitle: formatFullDate(nextYearlyDate),
        counter: formatCounter(nextYearlyDate),
        targetDate: nextYearlyDate,
        isCustom: true,
        originalItem: item
      });
      return;
    }

    items.push({
      id: item.id,
      label,
      subtitle: item.repeatEvery === 'none' ? '고정 날짜' : item.repeatEvery,
      counter: formatCounter(targetDate),
      targetDate,
      isCustom: true,
      originalItem: item
    });
  });

  return items.sort((left, right) => left.targetDate - right.targetDate);
}

function formatCounter(targetDate) {
  const diff = diffInDays(targetDate);

  if (diff === 0) {
    return 'D-Day';
  }

  if (diff > 0) {
    return `D-${diff}`;
  }

  return `D+${Math.abs(diff)}`;
}

function getNextYearlyDate(baseDate) {
  const base = startOfDay(baseDate);
  const today = startOfDay(new Date());
  let year = today.getFullYear();
  let candidate = createYearlyOccurrence(base, year);

  if (candidate < today) {
    candidate = createYearlyOccurrence(base, year + 1);
  }

  return candidate;
}

function createYearlyOccurrence(baseDate, year) {
  const month = baseDate.getMonth();
  const day = baseDate.getDate();
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDayOfMonth));
}
