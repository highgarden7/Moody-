import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import {
  deleteObject,
  getBlob,
  getDownloadURL,
  ref,
  uploadBytes
} from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { useEffect, useState } from 'react';
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

  // 첫 사진이면 부모 문서를 완성 처리한다.
  const itemSnap = await getDoc(bucketDoc(coupleId, itemId));
  if (itemSnap.exists() && itemSnap.data().status === 'open') {
    try {
      await updateDoc(bucketDoc(coupleId, itemId), {
        status: 'done',
        completedBy: uid,
        completedAt: serverTimestamp(),
        coverThumbUrl: thumbUrl
      });
    } catch {
      // 다른 사진이 먼저 완성 처리한 경우(레이스) 무시
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
