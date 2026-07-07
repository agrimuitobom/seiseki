import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';

export type Material = {
  id: string;
  owner: string;
  subject: string; // 科目
  fileName: string; // 元のファイル名
  storagePath: string; // Storage 上のパス
  downloadURL: string; // 閲覧用URL
  contentType: string; // image/* または application/pdf
  size: number; // バイト数
  createdAt: number; // アップロード時刻（ミリ秒）
  // フェーズ2（AI問題生成）用。OCR/抽出したテキストを後で格納する。
  extractedText?: string | null;
};

const colRef = collection(db, 'materials');

/** 本人のプリントを購読。新しい順（createdAt 降順）で返す。 */
export function watchMaterials(uid: string, cb: (rows: Material[]) => void) {
  const q = query(colRef, where('owner', '==', uid));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<Material, 'id'>) }),
    );
    rows.sort((a, b) => b.createdAt - a.createdAt);
    cb(rows);
  });
}

/**
 * プリントをアップロード（Storage へ保存 → メタdata を Firestore に登録）。
 * onProgress には 0〜100 の進捗率が渡る。
 */
export async function uploadMaterial(
  uid: string,
  subject: string,
  file: File,
  onProgress?: (pct: number) => void,
) {
  const safeName = `${Date.now()}_${file.name.replace(/[^\w.\-ぁ-んァ-ヶ一-龠]/g, '_')}`;
  const storagePath = `materials/${uid}/${subject}/${safeName}`;
  const storageRef = ref(storage, storagePath);

  const task = uploadBytesResumable(storageRef, file, { contentType: file.type });
  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (s) => onProgress?.(s.totalBytes > 0 ? (s.bytesTransferred / s.totalBytes) * 100 : 0),
      reject,
      resolve,
    );
  });
  const downloadURL = await getDownloadURL(storageRef);

  await addDoc(colRef, {
    owner: uid,
    subject,
    fileName: file.name,
    storagePath,
    downloadURL,
    contentType: file.type,
    size: file.size,
    createdAt: Date.now(),
    extractedText: null,
  });
}

/** プリントを削除（Storage 実体 → Firestore メタの順で消す）。 */
export async function removeMaterial(m: Material) {
  await deleteObject(ref(storage, m.storagePath)).catch(() => {
    // 実体が既に無くてもメタは消す
  });
  await deleteDoc(doc(db, 'materials', m.id));
}
