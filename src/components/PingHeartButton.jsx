export default function PingHeartButton({ busy, sentToday, onSend }) {
  return (
    <button
      aria-label={sentToday ? '오늘 보냄' : '보고싶다 보내기'}
      className={`icon-btn heart-btn${sentToday ? ' sent' : ''}`}
      disabled={busy || sentToday}
      onClick={onSend}
      title={sentToday ? '오늘 보냄' : '보고싶다'}
      type="button"
    >
      <svg
        aria-hidden="true"
        fill={sentToday ? 'currentColor' : 'none'}
        height="20"
        viewBox="0 0 24 24"
        width="20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 20.4s-6.7-4.3-9.2-8.1C1.3 9.9 2 6.7 4.5 5.1c2-1.2 4.4-.8 6 .9L12 7.6l1.5-1.6c1.6-1.7 4-2.1 6-.9 2.5 1.6 3.2 4.8 1.7 7.2-2.5 3.8-9.2 8.1-9.2 8.1Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    </button>
  );
}
