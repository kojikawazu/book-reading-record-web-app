import { BookStatus, ReflectionInput } from "./types";

/** フィールド名 → エラーメッセージ（先頭1件）のマップ。空なら検証成功。 */
export type ValidationErrors = Record<string, string>;

// value が [min, max]（両端含む）に収まるか。
const within = (value: number, min: number, max: number): boolean => value >= min && value <= max;

/**
 * カンマ区切りのタグ文字列を、trim 済み・空要素除去済みの配列へ正規化する。
 *
 * @param raw - カンマ区切りのタグ入力
 * @returns 正規化したタグ配列
 */
export const normalizeTags = (raw: string): string[] => {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
};

/**
 * 書籍登録フォームを検証する。制約は docs/06-security-specification.md §2 に準拠。
 * 初期ステータスに `completed` は許可しない。
 *
 * @param input - フォーム入力値
 * @param input.title - タイトル
 * @param input.author - 著者
 * @param input.genre - ジャンル
 * @param input.totalPages - 総ページ数
 * @param input.tags - 正規化済みタグ配列
 * @param input.status - 初期ステータス
 * @returns フィールド別エラー（問題なければ空オブジェクト）
 */
export const validateBookForm = (input: {
  title: string;
  author: string;
  genre: string;
  totalPages: number;
  tags: string[];
  status: BookStatus;
}): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (input.title.trim().length < 1 || input.title.trim().length > 200) {
    errors.title = "タイトルは1〜200文字で入力してください。";
  }

  if (input.author.trim().length < 1 || input.author.trim().length > 120) {
    errors.author = "著者は1〜120文字で入力してください。";
  }

  if (input.genre.trim().length > 80) {
    errors.genre = "ジャンルは80文字以内で入力してください。";
  }

  if (!Number.isInteger(input.totalPages) || !within(input.totalPages, 1, 100000)) {
    errors.totalPages = "総ページ数は1〜100000の整数で入力してください。";
  }

  if (input.tags.length > 10) {
    errors.tags = "タグは最大10件までです。";
  } else if (input.tags.some((tag) => tag.length < 1 || tag.length > 30)) {
    errors.tags = "タグは1〜30文字で入力してください。";
  }

  if (input.status === "completed") {
    errors.status = "初期ステータスに完読は指定できません。";
  }

  return errors;
};

/**
 * 進捗記録フォームを検証する。到達ページが総ページ未満のまま `completed` を選ぶと状態不整合として弾く。
 *
 * @param input - 進捗フォーム入力値（総ページ数を含む）
 * @param input.page - 到達ページ
 * @param input.totalPages - 総ページ数
 * @param input.status - 選択ステータス
 * @param input.memo - メモ
 * @returns フィールド別エラー（問題なければ空オブジェクト）
 */
export const validateProgressForm = (input: {
  page: number;
  totalPages: number;
  status: BookStatus;
  memo: string;
}): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (!Number.isInteger(input.page) || !within(input.page, 0, 100000)) {
    errors.page = "到達ページは0〜100000の整数で入力してください。";
  }

  if (input.memo.length > 5000) {
    errors.memo = "メモは5000文字以内で入力してください。";
  }

  if (input.status === "completed" && input.page < input.totalPages) {
    errors.status = "完読にするには到達ページを総ページ以上にしてください。";
  }

  return errors;
};

/**
 * 感想入力を検証する。3項目とも空入力可で、上限（各5000文字）のみを検査する。
 *
 * @param input - 感想入力（学び/行動/一文）
 * @returns フィールド別エラー（問題なければ空オブジェクト）
 */
export const validateReflection = (input: ReflectionInput): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (input.learning.length > 5000) {
    errors.learning = "学びは5000文字以内で入力してください。";
  }

  if (input.action.length > 5000) {
    errors.action = "次の行動は5000文字以内で入力してください。";
  }

  if (input.quote.length > 5000) {
    errors.quote = "印象に残った一文は5000文字以内で入力してください。";
  }

  return errors;
};
