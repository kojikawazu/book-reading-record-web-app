// `local` モード（localStorage 永続化）に関する定数。

/** `local` モードの localStorage 保存キー。バージョンをキー名に含める。 */
export const STORAGE_KEY = "book-reading-record.v1";
/** 永続化ペイロードのスキーマバージョン。値が変わる移行時は再初期化する。 */
export const STORAGE_VERSION = 1;
/** 破損データ復旧の通知フラグを保持する localStorage キー。 */
export const RECOVERY_NOTICE_KEY = `${STORAGE_KEY}.recoveryNotice`;

/** localStorage 未設定時・破損復旧時に書き込む初期ペイロード。 */
export const INITIAL_STORAGE_PAYLOAD = {
  version: STORAGE_VERSION,
  books: [],
  progressLogs: [],
};
