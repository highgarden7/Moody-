import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addBucketComment,
  addBucketItem,
  addBucketPhoto,
  deleteBucketComment,
  deleteBucketItemFully,
  deleteBucketPhoto,
  deleteOpenBucketItem,
  editBucketComment,
  setDeleteVote,
  updateBucketCompletedDate,
  updateBucketTitle,
  useBucketComments,
  useBucketItems,
  useDoneBucketItems,
  useBucketPhotos,
  downloadOriginal
} from '../hooks/useBucketData';

export default function BucketSection({ coupleId, currentUser, members, refreshToken, toast }) {
  const myUid = currentUser.uid;
  const memberUids = Array.isArray(members) ? members : [];
  const partnerUid = memberUids.find((uid) => uid !== myUid) || null;

  const {
    items: openItems,
    hasMore: openHasMore,
    loading: openLoading,
    loadMore: loadMoreOpen,
    appendItem: appendOpenItem,
    removeItem: removeOpenItem
  } = useBucketItems(coupleId, refreshToken);
  const [listTab, setListTab] = useState('open');
  const [doneEnabled, setDoneEnabled] = useState(false);
  const { items: doneItems, hasMore: doneHasMore, loading: doneLoading, loadMore: loadMoreDone, reload: reloadDone } = useDoneBucketItems(coupleId, doneEnabled);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const processedRef = useRef(new Set());
  const openSentinelRef = useRef(null);
  const sentinelRef = useRef(null);

  // selectedItem: open 목록에서 먼저 찾고, 없으면 done 목록에서 찾음
  const selectedItem = useMemo(
    () => openItems.find((i) => i.id === selectedItemId)
      || doneItems.find((i) => i.id === selectedItemId)
      || null,
    [openItems, doneItems, selectedItemId]
  );

  function openDoneTab() {
    setListTab('done');
    setDoneEnabled(true);
  }

  useEffect(() => {
    if (!openSentinelRef.current || listTab !== 'open') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreOpen();
      },
      { threshold: 0.1 }
    );
    observer.observe(openSentinelRef.current);
    return () => observer.disconnect();
  }, [listTab, loadMoreOpen]);

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
      const nextItem = await addBucketItem(coupleId, myUid, newTitle);
      appendOpenItem(nextItem);
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
    if (files.length === 0) return;
    const wasOpen = openItems.some((i) => i.id === itemId);
    setUploadingId(itemId);
    try {
      for (const file of files) {
        await addBucketPhoto(coupleId, itemId, myUid, file);
      }
      toast('사진을 추가했어.');
      if (wasOpen) {
        // open→done 전환: 완성탭으로 이동하고 목록 갱신
        removeOpenItem(itemId);
        setSelectedItemId(null);
        openDoneTab();
        reloadDone();
      }
    } catch (error) {
      toast(error.message || '사진 업로드에 실패했어.');
    } finally {
      setUploadingId(null);
    }
  }

  async function handleDeleteOpen(itemId) {
    try {
      await deleteOpenBucketItem(coupleId, itemId);
      removeOpenItem(itemId);
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
              placeholder="같이 하고 싶은 걸 적어줘"
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
          onClick={openDoneTab}
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
          <>
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
            <div ref={openSentinelRef} className="bucket-done-sentinel">
              {openLoading && <p className="muted" style={{ textAlign: 'center', padding: '12px 0' }}>불러오는 중...</p>}
              {!openHasMore && openItems.length > 0 && (
                <p className="muted" style={{ textAlign: 'center', padding: '12px 0', fontSize: '13px' }}>모두 불러왔어 ✓</p>
              )}
            </div>
          </>
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
  const photoCount = (item.coverThumbUrls || (item.coverThumbUrl ? [item.coverThumbUrl] : [])).length;
  const ghostCount = Math.min(photoCount - 1, 2); // 뒤에 겹치는 흰 레이어 수 (최대 2)
  const noteColor = index % 2 === 0 ? 'note-yellow' : 'note-peach';
  const noteTilt = index % 2 === 0 ? 'tilt-left' : 'tilt-right';

  return (
    <article className="bucket-done-card">
      <button
        className={`bucket-done-card-btn note ${noteColor} ${noteTilt}`}
        onClick={onSelect}
        type="button"
      >
        <div className="done-photo-stack">
          {ghostCount >= 2 && <div className="done-photo-ghost ghost-far" />}
          {ghostCount >= 1 && <div className="done-photo-ghost ghost-near" />}
          <div className="done-photo-polaroid">
            {item.coverThumbUrl
              ? <img alt="" loading="lazy" src={item.coverThumbUrl} />
              : null}
          </div>
        </div>
        <span className="bucket-done-card-title">
          {item.completedDate && <span className="done-card-date">{item.completedDate}</span>}
          {item.title}
        </span>
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
  const photoLimit = 5;
  const photosFull = isDone && photos.length >= photoLimit;
  const [titleDraft, setTitleDraft] = useState(item.title);
  const [savingTitle, setSavingTitle] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [savingDate, setSavingDate] = useState(false);

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

  async function handleDateChange(e) {
    const raw = e.target.value; // "yyyy-mm-dd" or ""
    const formatted = raw ? raw.replace(/-/g, '.') : '';
    setSavingDate(true);
    try {
      await updateBucketCompletedDate(coupleId, item.id, formatted);
    } catch (error) {
      toast(error.message || '날짜 저장에 실패했어.');
    } finally {
      setSavingDate(false);
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
          <>
            <h2 className="bucket-detail-title">{item.title}</h2>
            <div className="bucket-date-row">
              <span className="bucket-date-label">완료날짜</span>
              <input
                className="bucket-date-input"
                disabled={savingDate}
                max="2099-12-31"
                min="2000-01-01"
                onChange={handleDateChange}
                type="date"
                value={item.completedDate ? item.completedDate.replace(/\./g, '-') : ''}
              />
            </div>
          </>
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
          {photosFull ? (
            <span className="muted" style={{ fontSize: '13px' }}>최대 {photoLimit}장</span>
          ) : (
            <UploadButton
              busy={uploading}
              label={isDone ? '사진 추가' : '사진으로 완성하기'}
              onFiles={(files) => {
                if (isDone) {
                  const limited = Array.from(files).slice(0, photoLimit - photos.length);
                  if (limited.length > 0) onFiles(item.id, limited);
                } else {
                  onFiles(item.id, files);
                }
              }}
            />
          )}
        </div>

        {photos.length === 0 ? (
          <p className="muted">아직 사진이 없어.</p>
        ) : (
          <div className="bucket-photo-grid">
            {photos.map((photo, index) => (
              <figure className="bucket-photo" key={photo.id}>
                <button className="bucket-photo-thumb-btn" onClick={() => setLightboxIndex(index)} type="button">
                  <img alt="" loading="lazy" src={photo.thumbUrl} />
                </button>
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

        {lightboxIndex !== null && (
          <Lightbox
            photos={photos}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onChange={setLightboxIndex}
          />
        )}
      </section>

      {isDone && (
        <CommentsSection coupleId={coupleId} itemId={item.id} myUid={myUid} toast={toast} />
      )}

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

function Lightbox({ photos, index, onClose, onChange }) {
  const photo = photos[index];

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) onChange(index - 1);
      if (e.key === 'ArrowRight' && index < photos.length - 1) onChange(index + 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, photos.length, onClose, onChange]);

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose} type="button">✕</button>
        <img alt="" className="lightbox-img" src={photo.originalUrl || photo.thumbUrl} />
        {photos.length > 1 && (
          <div className="lightbox-nav">
            <button
              className="lightbox-nav-btn"
              disabled={index === 0}
              onClick={() => onChange(index - 1)}
              type="button"
            >
              ‹
            </button>
            <span className="lightbox-counter">{index + 1} / {photos.length}</span>
            <button
              className="lightbox-nav-btn"
              disabled={index === photos.length - 1}
              onClick={() => onChange(index + 1)}
              type="button"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
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

function CommentsSection({ coupleId, itemId, myUid, toast }) {
  const { comments } = useBucketComments(coupleId, itemId);
  const [newText, setNewText] = useState('');
  const [posting, setPosting] = useState(false);

  const threads = useMemo(() => {
    const roots = comments.filter((c) => !c.parentId);
    return roots.map((c) => ({
      ...c,
      replies: comments.filter((r) => r.parentId === c.id)
    }));
  }, [comments]);

  async function handlePost(e) {
    e.preventDefault();
    if (!newText.trim()) return;
    setPosting(true);
    try {
      await addBucketComment(coupleId, itemId, myUid, newText);
      setNewText('');
    } catch (err) {
      toast(err.message || '댓글 작성에 실패했어.');
    } finally {
      setPosting(false);
    }
  }

  return (
    <section className="panel paper-card">
      <h3>댓글</h3>

      {threads.length === 0 && (
        <p className="muted">아직 댓글이 없어.</p>
      )}

      <div className="comment-list">
        {threads.map((comment, i) => (
          <div className="comment-thread" key={comment.id}>
            <CommentNote
              comment={comment}
              index={i * 2}
              myUid={myUid}
              coupleId={coupleId}
              itemId={itemId}
              isReply={false}
              toast={toast}
            />
            {comment.replies.map((reply, ri) => (
              <CommentNote
                key={reply.id}
                comment={reply}
                index={i * 2 + ri + 1}
                myUid={myUid}
                coupleId={coupleId}
                itemId={itemId}
                isReply={true}
                toast={toast}
              />
            ))}
          </div>
        ))}
      </div>

      <form className="comment-form" onSubmit={handlePost}>
        <input
          onChange={(e) => setNewText(e.target.value)}
          placeholder="댓글을 남겨봐..."
          value={newText}
        />
        <button className="btn-primary comment-submit" disabled={posting || !newText.trim()} type="submit">
          작성
        </button>
      </form>
    </section>
  );
}

function CommentNote({ comment, index, myUid, coupleId, itemId, isReply, toast }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.text);
  const [saving, setSaving] = useState(false);
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [postingReply, setPostingReply] = useState(false);

  const isOwn = comment.createdBy === myUid;
  const noteClass = index % 2 === 0 ? 'note-yellow' : 'note-peach';

  useEffect(() => {
    if (!editing) setDraft(comment.text);
  }, [comment.text, editing]);

  async function handleSave() {
    if (!draft.trim() || draft.trim() === comment.text) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await editBucketComment(coupleId, itemId, comment.id, draft);
      setEditing(false);
    } catch (err) {
      toast(err.message || '수정에 실패했어.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await deleteBucketComment(coupleId, itemId, comment.id);
    } catch (err) {
      toast(err.message || '삭제에 실패했어.');
    }
  }

  async function handleReply(e) {
    e.preventDefault();
    if (!replyText.trim()) return;
    setPostingReply(true);
    try {
      await addBucketComment(coupleId, itemId, myUid, replyText, comment.id);
      setReplyText('');
      setReplying(false);
    } catch (err) {
      toast(err.message || '대댓글 작성에 실패했어.');
    } finally {
      setPostingReply(false);
    }
  }

  return (
    <div className={`comment-note-wrap${isReply ? ' comment-reply' : ''}`}>
      <div className={`comment-postit ${noteClass}`}>
        {editing ? (
          <div className="comment-edit-row">
            <input
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              value={draft}
            />
            <button className="btn-primary comment-submit" disabled={saving} onClick={handleSave} type="button">
              저장
            </button>
            <button
              className="btn-ghost"
              onClick={() => { setEditing(false); setDraft(comment.text); }}
              type="button"
            >
              취소
            </button>
          </div>
        ) : (
          <p className="comment-text">{comment.text}</p>
        )}

        {comment.updatedAt && !editing && (
          <span className="comment-meta">(수정됨)</span>
        )}

        <div className="comment-actions">
          {!isReply && (
            <button className="comment-action-btn" onClick={() => setReplying(!replying)} type="button">
              답글
            </button>
          )}
          {isOwn && !editing && (
            <>
              <button className="comment-action-btn" onClick={() => setEditing(true)} type="button">
                수정
              </button>
              <button className="comment-action-btn danger" onClick={handleDelete} type="button">
                삭제
              </button>
            </>
          )}
        </div>
      </div>

      {replying && (
        <form className="comment-reply-form" onSubmit={handleReply}>
          <input
            autoFocus
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="답글을 입력해줘..."
            value={replyText}
          />
          <button className="btn-primary comment-submit" disabled={postingReply || !replyText.trim()} type="submit">
            작성
          </button>
          <button className="btn-ghost" onClick={() => setReplying(false)} type="button">
            취소
          </button>
        </form>
      )}
    </div>
  );
}
