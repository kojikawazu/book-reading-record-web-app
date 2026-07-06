import { NextRequest, NextResponse } from "next/server";
import { CreateBookInput } from "@/lib/types";
import { isAuthGuardError, requireAuthenticatedUser } from "@/lib/server/auth-guard";
import {
  isRepositoryError,
  PrismaBookRecordRepository,
} from "@/lib/server/prisma-book-record-repository";

const repository = new PrismaBookRecordRepository();

const BOOK_STATUS_VALUES = ["not_started", "reading", "paused"] as const;
const BOOK_FORMAT_VALUES = ["paper", "ebook", "audio"] as const;

/**
 * リクエストボディを CreateBookInput へ検証・変換する。型・必須・列挙値のいずれかが不正なら null。
 *
 * @param body - JSON パース済みのリクエストボディ
 * @returns 妥当な入力、または不正時は null
 */
const parseCreateBookInput = (body: unknown): CreateBookInput | null => {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;
  const status = candidate.status;
  const format = candidate.format;

  if (
    typeof candidate.title !== "string" ||
    typeof candidate.author !== "string" ||
    typeof candidate.genre !== "string" ||
    typeof candidate.totalPages !== "number" ||
    !Array.isArray(candidate.tags) ||
    !BOOK_STATUS_VALUES.includes(status as (typeof BOOK_STATUS_VALUES)[number]) ||
    !BOOK_FORMAT_VALUES.includes(format as (typeof BOOK_FORMAT_VALUES)[number])
  ) {
    return null;
  }

  const tags = candidate.tags.filter((value): value is string => typeof value === "string");
  const typedStatus = status as (typeof BOOK_STATUS_VALUES)[number];
  const typedFormat = format as (typeof BOOK_FORMAT_VALUES)[number];

  return {
    title: candidate.title,
    author: candidate.author,
    genre: candidate.genre,
    format: typedFormat,
    totalPages: candidate.totalPages,
    tags,
    status: typedStatus,
  };
};

const errorResponse = (message: string, status: number): NextResponse => {
  return NextResponse.json({ message }, { status });
};

/**
 * GET /api/book-record/books — 書籍一覧を取得する（未認証可）。
 *
 * @returns 書籍一覧 JSON、またはエラー時のエラーレスポンス
 */
export async function GET() {
  try {
    const books = await repository.listBooks();
    return NextResponse.json({ books });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return errorResponse(error.message, error.statusCode);
    }

    if (isRepositoryError(error)) {
      return errorResponse(error.message, error.statusCode);
    }

    return errorResponse("書籍一覧の取得に失敗しました。", 500);
  }
}

/**
 * POST /api/book-record/books — 書籍を作成する（Bearer 認証必須）。
 *
 * @param request - 受信リクエスト（Authorization ヘッダと書籍作成ボディ）
 * @returns 作成した書籍 JSON（201）、またはエラー時のエラーレスポンス
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuthenticatedUser(request);
    const body = await request.json();
    const input = parseCreateBookInput(body);

    if (!input) {
      return errorResponse("書籍作成リクエストが不正です。", 400);
    }

    const book = await repository.createBook(input);
    return NextResponse.json({ book }, { status: 201 });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return errorResponse(error.message, error.statusCode);
    }

    if (isRepositoryError(error)) {
      return errorResponse(error.message, error.statusCode);
    }

    return errorResponse("書籍の作成に失敗しました。", 500);
  }
}
