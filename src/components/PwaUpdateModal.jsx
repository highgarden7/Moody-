export default function PwaUpdateModal({ onUpdate }) {
  return (
    <div className="update-modal-backdrop" role="presentation">
      <section
        aria-labelledby="pwa-update-title"
        aria-modal="true"
        className="update-modal"
        role="dialog"
      >
        <p className="update-modal-label">업데이트</p>
        <h2 id="pwa-update-title">새 버전이 있어요.</h2>
        <p className="muted">업데이트할게요.</p>
        <button className="btn-primary update-modal-button" onClick={onUpdate} type="button">
          지금 업데이트
        </button>
      </section>
    </div>
  );
}
