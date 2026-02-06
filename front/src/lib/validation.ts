import { BookStatus, ReflectionInput } from "./types";

export type ValidationErrors = Record<string, string>;

const within = (value: number, min: number, max: number): boolean => value >= min && value <= max;

export const normalizeTags = (raw: string): string[] => {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
};

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
