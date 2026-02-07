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
