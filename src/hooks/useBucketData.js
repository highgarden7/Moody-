import {
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where
} from 'firebase/firestore';
import {
  deleteObject,
  getBlob,
  getDownloadURL,
  ref,
  uploadBytes
} from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { useCallback, useEffect, useRef, useState } from 'react';
import { db, storage } from '../firebase';

const THUMB_OPTIONS = {
  maxWidthOrHeight: 400,
  maxSizeMB: 0.2,
  fileType: 'image/webp',
  useWebWorker: true,
  initialQuality: 0.7
};

function ensureReady() {
  if (!db || !storage) {
    throw new Error('Firebase 설정이 비어 있거나 잘못됐어.');
  }
}

function bucketCollection(coupleId) {
  return collection(db, 'couples', coupleId, 'bucket');
}

function bucketDoc(coupleId, itemId) {
  return doc(db, 'couples', coupleId, 'bucket', itemId);
}

function photosCollection(coupleId, itemId) {
  return collection(db, 'couples', coupleId, 'bucket', itemId, 'photos');
}

export function useBucketItems(coupleId, refreshToken = 0) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!coupleId || !db) {
      setItems([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(query(bucketCollection(coupleId)), (snapshot) => {
      setItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setLoading(false);
    });

    return unsubscribe;
  }, [coupleId, refreshToken]);

  return { items, loading };
}

export function useBucketPhotos(coupleId, itemId) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!coupleId || !itemId || !db) {
      setPhotos([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(query(photosCollection(coupleId, itemId)), (snapshot) => {
      setPhotos(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setLoading(false);
    });

    return unsubscribe;
  }, [coupleId, itemId]);

  return { photos, loading };
}

const DONE_PAGE_INITIAL = 9;
const DONE_PAGE_MORE = 6;

export function useDoneBucketItems(coupleId) {
  const [items, setItems] = useState([]);
  const [lastDocRef, setLastDocRef] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!coupleId || !db) {
      setItems([]);
      setHasMore(false);
      return;
    }

    setItems([]);
    setLastDocRef(null);
    setHasMore(true);
    setLoading(true);
    loadingRef.current = true;

    const q = query(
      bucketCollection(coupleId),
      where('status', '==', 'done'),
      orderBy('completedAt', 'desc'),
      limit(DONE_PAGE_INITIAL)
    );

    getDocs(q).then(async (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      // coverThumbUrls 없는 기존 완성 항목은 photos 서브컬렉션에서 썸네일을 읽어 1회 채운다.
      await Promise.all(
        docs
          .filter((item) => item.coverThumbUrl && !item.coverThumbUrls)
          .map(async (item) => {
            const photosSnap = await getDocs(query(photosCollection(coupleId, item.id), limit(3)));
            const thumbUrls = photosSnap.docs.map((d) => d.data().thumbUrl).filter(Boolean);
            if (thumbUrls.length > 0) {
              await updateDoc(bucketDoc(coupleId, item.id), { coverThumbUrls: thumbUrls });
              item.coverThumbUrls = thumbUrls;
            }
          })
      );

      setItems(docs);
      setLastDocRef(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === DONE_PAGE_INITIAL);
      setLoading(false);
      loadingRef.current = false;
    });
  }, [coupleId]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore || !coupleId || !db) return;
    loadingRef.current = true;
    setLoading(true);

    const q = query(
      bucketCollection(coupleId),
      where('status', '==', 'done'),
      orderBy('completedAt', 'desc'),
      startAfter(lastDocRef),
      limit(DONE_PAGE_MORE)
    );

    const snapshot = await getDocs(q);
    setItems((prev) => [...prev, ...snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))]);
    setLastDocRef(snapshot.docs[snapshot.docs.length - 1] || null);
    setHasMore(snapshot.docs.length === DONE_PAGE_MORE);
    setLoading(false);
    loadingRef.current = false;
  }, [coupleId, lastDocRef, hasMore]);

  return { items, hasMore, loading, loadMore };
}

export async function addBucketItem(coupleId, uid, title) {
  ensureReady();
  const trimmed = title.trim();
  if (!trimmed) {
    throw new Error('내용을 입력해줘.');
  }

  const itemRef = doc(bucketCollection(coupleId));
  await setDoc(itemRef, {
    title: trimmed,
    createdBy: uid,
    createdAt: serverTimestamp(),
    status: 'open',
    deleteVotes: {}
  });
  return itemRef.id;
}

export async function updateBucketTitle(coupleId, itemId, title) {
  ensureReady();
  const trimmed = title.trim();
  if (!trimmed) {
    throw new Error('내용을 입력해줘.');
  }
  await updateDoc(bucketDoc(coupleId, itemId), { title: trimmed });
}

function extensionFor(file) {
  const fromName = file.name?.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
  if (fromName && fromName.length <= 5) {
    return fromName;
  }
  const fromType = file.type?.split('/')[1];
  return fromType || 'jpg';
}

// 사진 1장 업로드: 원본은 그대로, 썸네일은 별도 생성해 함께 올린다.
// 해당 아이템이 open이면 첫 사진이므로 done으로 전환한다.
export async function addBucketPhoto(coupleId, itemId, uid, file) {
  ensureReady();

  const photoRef = doc(photosCollection(coupleId, itemId));
  const photoId = photoRef.id;
  const basePath = `couples/${coupleId}/bucket/${itemId}/${photoId}`;
  const originalPath = `${basePath}/original.${extensionFor(file)}`;
  const thumbPath = `${basePath}/thumb.webp`;

  const originalRef = ref(storage, originalPath);
  await uploadBytes(originalRef, file, { contentType: file.type || undefined });
  const originalUrl = await getDownloadURL(originalRef);

  const thumbBlob = await imageCompression(file, THUMB_OPTIONS);
  const thumbRef = ref(storage, thumbPath);
  await uploadBytes(thumbRef, thumbBlob, { contentType: 'image/webp' });
  const thumbUrl = await getDownloadURL(thumbRef);

  await setDoc(photoRef, {
    originalUrl,
    originalPath,
    thumbUrl,
    thumbPath,
    uploadedBy: uid,
    uploadedAt: serverTimestamp()
  });

  // 첫 사진이면 완성 처리, 이후 사진은 coverThumbUrls 배열(최대 3장)에 추가한다.
  const itemSnap = await getDoc(bucketDoc(coupleId, itemId));
  if (itemSnap.exists()) {
    const data = itemSnap.data();
    if (data.status === 'open') {
      try {
        await updateDoc(bucketDoc(coupleId, itemId), {
          status: 'done',
          completedBy: uid,
          completedAt: serverTimestamp(),
          coverThumbUrl: thumbUrl,
          coverThumbUrls: [thumbUrl]
        });
      } catch {
        // 다른 사진이 먼저 완성 처리한 경우(레이스) 무시
      }
    } else {
      const existing = data.coverThumbUrls || [];
      if (existing.length < 3) {
        // coverThumbUrls가 없는 기존 데이터는 coverThumbUrl을 첫 원소로 포함시켜 초기화한다.
        if (existing.length === 0 && data.coverThumbUrl) {
          await updateDoc(bucketDoc(coupleId, itemId), {
            coverThumbUrls: [data.coverThumbUrl, thumbUrl]
          });
        } else {
          await updateDoc(bucketDoc(coupleId, itemId), {
            coverThumbUrls: arrayUnion(thumbUrl)
          });
        }
      }
    }
  }

  return { thumbUrl, originalUrl };
}

export async function setDeleteVote(coupleId, itemId, uid, agree) {
  ensureReady();
  await updateDoc(bucketDoc(coupleId, itemId), {
    [`deleteVotes.${uid}`]: agree ? true : deleteField()
  });
}

export async function deleteOpenBucketItem(coupleId, itemId) {
  ensureReady();
  await deleteDoc(bucketDoc(coupleId, itemId));
}

// 완성 항목 완전 삭제: photos 문서 + Storage 파일(original/thumb) 정리 후 부모 삭제.
export async function deleteBucketItemFully(coupleId, itemId) {
  ensureReady();

  const photosSnap = await getDocs(photosCollection(coupleId, itemId));
  for (const photoDoc of photosSnap.docs) {
    const data = photoDoc.data();
    if (data.originalPath) {
      await deleteObject(ref(storage, data.originalPath)).catch(() => {});
    }
    if (data.thumbPath) {
      await deleteObject(ref(storage, data.thumbPath)).catch(() => {});
    }
    await deleteDoc(photoDoc.ref).catch(() => {});
  }

  await deleteDoc(bucketDoc(coupleId, itemId)).catch(() => {});
}

// 원본을 Blob으로 받아 다운로드를 트리거한다(cross-origin download 속성 회피).
export async function downloadOriginal(originalPath, filename) {
  ensureReady();
  const blob = await getBlob(ref(storage, originalPath));
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || originalPath.split('/').pop() || 'photo';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
