export default function PushNotificationCard({
  enabled,
  busy,
  supported,
  permission,
  reason,
  onEnable,
  onDisable
}) {
  return (
    <section className="panel paper-card notification-card">
      <div className="summary-row summary-row-spread">
        <div>
          <h3>알림</h3>
          <p className="muted">
            {supported
              ? enabled
                ? '백그라운드 알림을 받을 준비가 됐어.'
                : permission === 'denied'
                  ? '브라우저 권한이 꺼져 있어.'
                  : '새 기록 알림을 받을 수 있어.'
              : reason}
          </p>
        </div>
        {supported ? (
          enabled ? (
            <button className="btn-secondary" disabled={busy} onClick={onDisable} type="button">
              알림 끄기
            </button>
          ) : (
            <button
              className="btn-secondary"
              disabled={busy || permission === 'denied'}
              onClick={onEnable}
              type="button"
            >
              알림 켜기
            </button>
          )
        ) : (
          <button className="btn-secondary" disabled type="button">
            알림 켜기
          </button>
        )}
      </div>
    </section>
  );
}
