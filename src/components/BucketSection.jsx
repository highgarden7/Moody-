import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addBucketItem,
  addBucketPhoto,
  deleteBucketItemFully,
  deleteBucketPhoto,
  deleteOpenBucketItem,
  setDeleteVote,
  updateBucketTitle,
  useBucketItems,
  useDoneBucketItems,
  useBucketPhotos,
  downloadOriginal
} from '../hooks/useBucketData';

export default function BucketSection({ coupleId, currentUser, members, refreshToken, toast }) {
  const myUid = currentUser.uid;
  const memberUids = Array.isArray(members) ? members : [];
  const partnerUid = memberUids.find((uid) => uid !== myUid) || null;

  const { items } = useBucketItems(coupleId, refreshToken);
  const { items: doneItems, hasMore: doneHasMore, loading: doneLoading, loadMore: loadMoreDone } = useDoneBucketItems(coupleId);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [listTab, setListTab] = useState('open');
  const processedRef = useRef(new Set());
  const sentinelRef = useRef(null);

  const openItems = useMemo(() => items.filter((item) => item.status !== 'done'), [items]);
  const allItems = useMemo(() => [...items, ...doneItems], [items, doneItems]);
  const selectedItem = useMemo(
    () => allItems.find((item) => item.id === selectedItemId) || null,
    [allItems, selectedItemId]
  );

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreDone();
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMoreDone]);

  // 두 멤버가 모두 삭제에 동의한 done 항목은 실제 삭제를 실행한다.
  useEffect(() => {
    if (memberUids.length < 2) {
      return;
    }

    doneItems.forEach((item) => {
      const votes = item.deleteVotes || {};
      const allAgreed = memberUids.every((uid) => votes[uid] === true);
      if (allAgreed && !processedRef.current.has(item.id)) {
        processedRef.current.add(item.id);
        deleteBucketItemFully(coupleId, item.id).catch(() => {
          processedRef.current.delete(item.id);
        });
      }
    });
  }, [doneItems, coupleId, memberUids]);

  async function handleAdd(event) {
    event.preventDefault();
    setAdding(true);
    try {
      await addBucketItem(coupleId, myUid, newTitle);
      setNewTitle('');
      toast('버킷리스트에 추가했어.');
    } catch (error) {
      toast(error.message || '추가에 실패했어.');
    } finally {
      setAdding(false);
    }
  }

  async function handleFiles(itemId, fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) {
      return;
    }
    setUploadingId(itemId);
    try {
      for (const file of files) {
        await addBucketPhoto(coupleId, itemId, myUid, file);
      }
      toast('사진을 추가했어.');
    } catch (error) {
      toast(error.message || '사진 업로드에 실패했어.');
    } finally {
      setUploadingId(null);
    }
  }

  async function handleDeleteOpen(itemId) {
    try {
      await deleteOpenBucketItem(coupleId, itemId);
      if (selectedItemId === itemId) {
        setSelectedItemId(null);
      }
      toast('항목을 삭제했어.');
    } catch (error) {
      toast(error.message || '삭제에 실패했어.');
    }
  }

  async function handleVote(itemId, uid, agree) {
    try {
      await setDeleteVote(coupleId, itemId, uid, agree);
    } catch (error) {
      toast(error.message || '처리에 실패했어.');
    }
  }

  if (selectedItem) {
    return (
      <BucketDetail
        coupleId={coupleId}
        item={selectedItem}
        myUid={myUid}
        partnerUid={partnerUid}
        uploading={uploadingId === selectedItem.id}
        onBack={() => setSelectedItemId(null)}
        onFiles={handleFiles}
        onDeleteOpen={handleDeleteOpen}
        onVote={handleVote}
        onRenamed={() => toast('제목을 수정했어.')}
        toast={toast}
      />
    );
  }

  return (
    <section className="tab-panel bucket-section">
      {listTab === 'open' && (
        <section className="panel paper-card">
          <form className="bucket-add" onSubmit={handleAdd}>
            <input
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="같이 하고 싶은 거 적어줘"
              value={newTitle}
            />
            <button className="btn-primary" disabled={adding} type="submit">
              추가
            </button>
          </form>
        </section>
      )}

      <div className="segmented bucket-toggle">
        <button
          className={listTab === 'open' ? 'active' : ''}
          onClick={() => setListTab('open')}
          type="button"
        >
          진행 중
        </button>
        <button
          className={listTab === 'done' ? 'active' : ''}
          onClick={() => setListTab('done')}
          type="button"
        >
          완성
        </button>
      </div>

      {listTab === 'open' ? (
        openItems.length === 0 ? (
          <section className="panel paper-card">
            <p className="muted">아직 진행 중인 버킷이 없어.</p>
          </section>
        ) : (
          <div className="note-stack">
            {openItems.map((item, index) => (
              <article className={`note bucket-note ${noteTone(index)}`} key={item.id}>
                <button
                  className="bucket-note-body"
                  onClick={() => setSelectedItemId(item.id)}
                  type="button"
                >
                  <strong>{item.title}</strong>
                </button>
                <div className="bucket-card-actions">
                  <UploadButton
                    busy={uploadingId === item.id}
                    label="사진으로 완성하기"
                    onFiles={(files) => handleFiles(item.id, files)}
                  />
                  {item.createdBy === myUid ? (
                    <button
                      className="btn-danger-soft"
                      onClick={() => handleDeleteOpen(item.id)}
                      type="button"
                    >
                      삭제
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )
      ) : doneItems.length === 0 ? (
        <section className="panel paper-card">
          <p className="muted">완성한 버킷이 아직 없어.</p>
        </section>
      ) : (
        <>
          <div className="bucket-done-grid">
            {doneItems.map((item, index) => (
              <DoneCard
                key={item.id}
                item={item}
                index={index}
                myUid={myUid}
                partnerUid={partnerUid}
                onSelect={() => setSelectedItemId(item.id)}
                onVote={handleVote}
              />
            ))}
          </div>
          <div ref={sentinelRef} className="bucket-done-sentinel">
            {doneLoading && <p className="muted" style={{ textAlign: 'center', padding: '12px 0' }}>불러오는 중...</p>}
            {!doneHasMore && doneItems.length > 0 && (
              <p className="muted" style={{ textAlign: 'center', padding: '12px 0', fontSize: '13px' }}>모두 불러왔어 ✓</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function noteTone(index) {
  return index % 2 === 0 ? 'note-yellow tilt-left' : 'note-peach tilt-right';
}

function DoneCard({ item, index, myUid, partnerUid, onSelect, onVote }) {
  const thumbs = item.coverThumbUrls || (item.coverThumbUrl ? [item.coverThumbUrl] : []);
  const noteColor = index % 2 === 0 ? 'note-yellow' : 'note-peach';
  const noteTilt = index % 2 === 0 ? 'tilt-left' : 'tilt-right';

  return (
    <article className="bucket-done-card">
      <button
        className={`bucket-done-card-btn note ${noteColor} ${noteTilt}`}
        onClick={onSelect}
        type="button"
      >
        <div className={`done-photo-stack count-${Math.min(thumbs.length, 3)}`}>
          {thumbs.slice(0, 3).map((url, i) => (
            <div className="done-photo-polaroid" key={i}>
              <img alt="" loading="lazy" src={url} />
            </div>
          ))}
          {thumbs.length === 0 && <div className="done-photo-empty" />}
        </div>
        <span className="bucket-done-card-title">{item.title}</span>
      </button>
      <DeleteConsent item={item} myUid={myUid} partnerUid={partnerUid} onVote={onVote} />
    </article>
  );
}

function BucketDetail({
  coupleId,
  item,
  myUid,
  partnerUid,
  uploading,
  onBack,
  onFiles,
  onDeleteOpen,
  onVote,
  onRenamed,
  toast
}) {
  const isDone = item.status === 'done';
  const { photos } = useBucketPhotos(coupleId, item.id);
  const [titleDraft, setTitleDraft] = useState(item.title);
  const [savingTitle, setSavingTitle] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState(null);

  useEffect(() => {
    setTitleDraft(item.title);
  }, [item.title]);

  async function handleSaveTitle() {
    if (titleDraft.trim() === item.title) {
      return;
    }
    setSavingTitle(true);
    try {
      await updateBucketTitle(coupleId, item.id, titleDraft);
      onRenamed();
    } catch (error) {
      toast(error.message || '제목 수정에 실패했어.');
    } finally {
      setSavingTitle(false);
    }
  }

  async function handleDeletePhoto(photo) {
    setDeletingPhotoId(photo.id);
    try {
      await deleteBucketPhoto(coupleId, item.id, photo, photos);
    } catch (error) {
      toast(error.message || '사진 삭제에 실패했어.');
    } finally {
      setDeletingPhotoId(null);
    }
  }

  async function handleDownload(photo, index) {
    setDownloadingId(photo.id);
    try {
      const ext = photo.originalPath?.split('.').pop() || 'jpg';
      await downloadOriginal(photo.originalPath, `${item.title}-${index + 1}.${ext}`);
    } catch (error) {
      toast(error.message || '다운로드에 실패했어.');
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <section className="tab-panel bucket-section">
      <section className="panel paper-card">
        <div className="summary-row summary-row-spread">
          <button className="btn-ghost" onClick={onBack} type="button">
            ← 목록
          </button>
          {isDone ? <span className="bucket-badge">완성</span> : null}
        </div>

        {isDone ? (
          <h2 className="bucket-detail-title">{item.title}</h2>
        ) : (
          <div className="bucket-title-edit">
            <input
              onChange={(event) => setTitleDraft(event.target.value)}
              value={titleDraft}
            />
            <button
              className="btn-secondary"
              disabled={savingTitle || titleDraft.trim() === item.title}
              onClick={handleSaveTitle}
              type="button"
            >
              제목 저장
            </button>
          </div>
        )}
      </section>

      <section className="panel paper-card">
        <div className="summary-row summary-row-spread">
          <h3>사진</h3>
          <UploadButton
            busy={uploading}
            label={isDone ? '사진 추가' : '사진으로 완성하기'}
            onFiles={(files) => onFiles(item.id, files)}
          />
        </div>

        {photos.length === 0 ? (
          <p className="muted">아직 사진이 없어.</p>
        ) : (
          <div className="bucket-photo-grid">
            {photos.map((photo, index) => (
              <figure className="bucket-photo" key={photo.id}>
                <img alt="" loading="lazy" src={photo.thumbUrl} />
                <button
                  className="btn-secondary bucket-download"
                  disabled={downloadingId === photo.id}
                  onClick={() => handleDownload(photo, index)}
                  type="button"
                >
                  {downloadingId === photo.id ? '받는 중...' : '원본 다운로드'}
                </button>
                {photos.length > 1 && (
                  <button
                    className="btn-danger-soft bucket-download"
                    disabled={deletingPhotoId === photo.id}
                    onClick={() => handleDeletePhoto(photo)}
                    type="button"
                  >
                    {deletingPhotoId === photo.id ? '삭제 중...' : '사진 삭제'}
                  </button>
                )}
              </figure>
            ))}
          </div>
        )}
      </section>

      <section className="panel paper-card">
        {isDone ? (
          <DeleteConsent item={item} myUid={myUid} partnerUid={partnerUid} onVote={onVote} expanded />
        ) : item.createdBy === myUid ? (
          <button
            className="btn-danger-soft"
            onClick={() => onDeleteOpen(item.id)}
            type="button"
          >
            이 항목 삭제
          </button>
        ) : (
          <p className="muted">사진 없는 항목은 만든 사람만 삭제할 수 있어.</p>
        )}
      </section>
    </section>
  );
}

function DeleteConsent({ item, myUid, partnerUid, onVote, expanded }) {
  const votes = item.deleteVotes || {};
  const myVote = votes[myUid] === true;
  const partnerVote = partnerUid ? votes[partnerUid] === true : false;

  if (myVote && !partnerVote) {
    return (
      <div className={consentClass(expanded)}>
        <span className="muted">상대 동의 대기 중</span>
        <button className="btn-secondary" onClick={() => onVote(item.id, myUid, false)} type="button">
          동의 취소
        </button>
      </div>
    );
  }

  if (!myVote && partnerVote) {
    return (
      <div className={consentClass(expanded)}>
        <span className="muted">상대가 삭제를 원해요</span>
        <div className="row-actions">
          <button className="btn-danger-soft" onClick={() => onVote(item.id, myUid, true)} type="button">
            동의
          </button>
          <button
            className="btn-secondary"
            onClick={() => onVote(item.id, partnerUid, false)}
            type="button"
          >
            거절
          </button>
        </div>
      </div>
    );
  }

  if (myVote && partnerVote) {
    return (
      <div className={consentClass(expanded)}>
        <span className="muted">삭제하는 중...</span>
      </div>
    );
  }

  return (
    <div className={consentClass(expanded)}>
      <button className="btn-danger-soft" onClick={() => onVote(item.id, myUid, true)} type="button">
        삭제
      </button>
    </div>
  );
}

function consentClass(expanded) {
  return expanded ? 'bucket-consent expanded' : 'bucket-consent';
}

function UploadButton({ busy, label, onFiles }) {
  return (
    <label className={`btn-secondary bucket-upload${busy ? ' is-busy' : ''}`}>
      {busy ? '올리는 중...' : label}
      <input
        accept="image/*"
        disabled={busy}
        hidden
        multiple
        onChange={(event) => {
          onFiles(event.target.files);
          event.target.value = '';
        }}
        type="file"
      />
    </label>
  );
}
