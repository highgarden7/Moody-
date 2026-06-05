export function buildGenericPushMessage(data = {}) {
  if (typeof data.title === 'string' && typeof data.body === 'string') {
    return {
      title: data.title,
      body: data.body
    };
  }

  switch (data.kind) {
    case 'dday':
      return {
        title: 'moody',
        body: '디데이 알림이 도착했어.'
      };
    case 'mood':
    case 'event':
      return {
        title: 'moody',
        body: '새 기록이 도착했어.'
      };
    default:
      return {
        title: 'moody',
        body: '새 알림이 도착했어.'
      };
  }
}
