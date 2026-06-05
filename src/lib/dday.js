import { diffInDays, daysSince, startOfDay } from './date';

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
      subtitle: `${togetherDays}일째`,
      counter: `D+${togetherDays - 1}`,
      targetDate: metDate,
    });
    items.push({
      id: 'anniversary-next-100',
      label: `${nextMilestone}일`,
      subtitle: '다음 100일',
      counter: formatCounter(nextMilestoneDate),
      targetDate: nextMilestoneDate,
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
        subtitle: '100일 반복',
        counter: formatCounter(nextCycleDate),
        targetDate: nextCycleDate,
      });
      return;
    }

    items.push({
      id: item.id,
      label,
      subtitle: item.repeatEvery === 'none' ? '고정 날짜' : item.repeatEvery,
      counter: formatCounter(targetDate),
      targetDate,
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
