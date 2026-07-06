import { NextRequest, NextResponse } from "next/server";
import { UpdateBookInput } from "@/lib/types";
import { isAuthGuardError, requireAuthenticatedUser } from "@/lib/server/auth-guard";
import {
  isRepositoryError,
  PrismaBookRecordRepository,
} from "@/lib/server/prisma-book-record-repository";

const repository = new PrismaBookRecordRepository();

const BOOK_STATUS_VALUES = ["not_started", "reading", "paused", "completed"] as const;
const BOOK_FORMAT_VALUES = ["paper", "ebook", "audio"] as const;

/**
 * リクエストボディを UpdateBookInput へ変換する。送られてきた妥当なフィールドのみ採用する
 * 部分更新用パーサ（フィールド欠落は無視するため、必ず非 null のパッチを返す）。
 *
 * @param body - JSON パース済みのリクエストボディ
 * @returns 採用したフィールドのみを含むパッチ、またはボディが非オブジェクトなら null
 */
const parseUpdateBookInput = (body: unknown): UpdateBookInput | null => {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;
  const patch: UpdateBookInput = {};

  if (typeof candidate.title === "string") {
    patch.title = candidate.title;
  }

  if (typeof candidate.author === "string") {
    patch.author = candidate.author;
  }

  if (typeof candidate.genre === "string") {
    patch.genre = candidate.genre;
  }

  if (
    typeof candidate.format === "string" &&
    BOOK_FORMAT_VALUES.includes(candidate.format as (typeof BOOK_FORMAT_VALUES)[number])
  ) {
    patch.format = candidate.format as (typeof BOOK_FORMAT_VALUES)[number];
  }

  if (typeof candidate.totalPages === "number") {
    patch.totalPages = candidate.totalPages;
  }

  if (typeof candidate.currentPage === "number") {
    patch.currentPage = candidate.currentPage;
  }

  if (Array.isArray(candidate.tags)) {
    patch.tags = candidate.tags.filter((value): value is string => typeof value === "string");
  }

  if (
    typeof candidate.status === "string" &&
    BOOK_STATUS_VALUES.includes(candidate.status as (typeof BOOK_STATUS_VALUES)[number])
  ) {
    patch.status = candidate.status as (typeof BOOK_STATUS_VALUES)[number];
  }

  if (typeof candidate.completedAt === "string") {
    patch.completedAt = candidate.completedAt;
  }

  return patch;
};

const errorResponse = (message: string, status: number): NextResponse => {
  return NextResponse.json({ message }, { status });
};

type Params = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * GET /api/book-record/books/[id] — 書籍を1冊取得する（未認証可）。
 *
 * @param _request - 受信リクエスト（未使用）
 * @param context - 動的ルートパラメータ（書籍 ID）
 * @returns 書籍 JSON、未検出は 404、その他はエラーレスポンス
 */
export async function GET(_request: NextRequest, context: Params) {
  try {
    const { id } = await context.params;
    const book = await repository.getBook(id);

    if (!book) {
      return errorResponse("対象の書籍が見つかりません。", 404);
    }

    return NextResponse.json({ book });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return errorResponse(error.message, error.statusCode);
    }

    if (isRepositoryError(error)) {
      return errorResponse(error.message, error.statusCode);
    }

    return errorResponse("書籍の取得に失敗しました。", 500);
  }
}

/**
 * PATCH /api/book-record/books/[id] — 書籍を更新する（再読含む・Bearer 認証必須）。
 *
 * @param request - 受信リクエスト（Authorization ヘッダと更新パッチ）
 * @param context - 動的ルートパラメータ（書籍 ID）
 * @returns 更新後の書籍 JSON、またはエラー時のエラーレスポンス
 */
export async function PATCH(request: NextRequest, context: Params) {
  try {
    await requireAuthenticatedUser(request);
    const { id } = await context.params;
    const body = await request.json();
    const patch = parseUpdateBookInput(body);

    if (!patch) {
      return errorResponse("書籍更新リクエストが不正です。", 400);
    }

    const book = await repository.updateBook(id, patch);
    return NextResponse.json({ book });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return errorResponse(error.message, error.statusCode);
    }

    if (isRepositoryError(error)) {
      return errorResponse(error.message, error.statusCode);
    }

    return errorResponse("書籍の更新に失敗しました。", 500);
  }
}
