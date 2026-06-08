export function buildGenericPushMessage(data = {}) {
  if (typeof data.body === 'string' && data.body.trim().length > 0) {
    return {
      title: typeof data.title === 'string' && data.title.trim().length > 0 ? data.title : 'Moody',
      body: data.body
    };
  }

  switch (data.kind) {
    case 'dday':
      return {
        title: 'Moody',
        body: '디데이 알림이 도착했어.'
      };
    case 'mood':
    case 'event':
      return {
        title: 'Moody',
        body: '새 기록이 도착했어.'
      };
    default:
      return {
        title: 'Moody',
        body: '새 알림이 도착했어.'
      };
  }
}
