export default function NotificationBell({
  enabled,
  busy,
  supported,
  permission,
  reason,
  onEnable,
  onDisable,
  toast
}) {
  const active = supported && enabled;

  function handleClick() {
    if (!supported) {
      toast(reason || '이 기기에서는 알림을 쓸 수 없어.');
      return;
    }

    if (permission === 'denied') {
      toast('브라우저 알림 권한이 꺼져 있어.');
      return;
    }

    if (enabled) {
      onDisable();
    } else {
      onEnable();
    }
  }

  return (
    <button
      aria-label={active ? '알림 끄기' : '알림 켜기'}
      aria-pressed={active}
      className={`icon-btn bell-btn${active ? ' active' : ''}`}
      disabled={busy}
      onClick={handleClick}
      title={active ? '알림 켜짐' : '알림 꺼짐'}
      type="button"
    >
      <svg
        aria-hidden="true"
        fill="none"
        height="20"
        viewBox="0 0 24 24"
        width="20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
          fill={active ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="M13.7 21a2 2 0 0 1-3.4 0"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    </button>
  );
}
