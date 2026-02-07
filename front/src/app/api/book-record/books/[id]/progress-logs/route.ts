import { NextRequest, NextResponse } from "next/server";
import { CreateProgressLogInput } from "@/lib/types";
import { isAuthGuardError, requireAuthenticatedUser } from "@/lib/server/auth-guard";
import {
  isRepositoryError,
  PrismaBookRecordRepository,
} from "@/lib/server/prisma-book-record-repository";

const repository = new PrismaBookRecordRepository();

const BOOK_STATUS_VALUES = ["not_started", "reading", "paused", "completed"] as const;

const parseCreateProgressInput = (body: unknown): CreateProgressLogInput | null => {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;
  const status = candidate.status;

  if (
    typeof candidate.page !== "number" ||
    typeof candidate.memo !== "string" ||
    typeof status !== "string" ||
    !BOOK_STATUS_VALUES.includes(status as (typeof BOOK_STATUS_VALUES)[number])
  ) {
    return null;
  }

  const typedStatus = status as (typeof BOOK_STATUS_VALUES)[number];

  const input: CreateProgressLogInput = {
    page: candidate.page,
    memo: candidate.memo,
    status: typedStatus,
  };

  if (typeof candidate.loggedAt === "string") {
    input.loggedAt = candidate.loggedAt;
  }

  return input;
};

const errorResponse = (message: string, status: number): NextResponse => {
  return NextResponse.json({ message }, { status });
};

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: NextRequest, context: Params) {
  try {
    const { id } = await context.params;
    const logs = await repository.listProgressLogs(id);
    return NextResponse.json({ logs });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return errorResponse(error.message, error.statusCode);
    }

    if (isRepositoryError(error)) {
      return errorResponse(error.message, error.statusCode);
    }

    return errorResponse("進捗履歴の取得に失敗しました。", 500);
  }
}

export async function POST(request: NextRequest, context: Params) {
  try {
    await requireAuthenticatedUser(request);
    const { id } = await context.params;
    const body = await request.json();
    const input = parseCreateProgressInput(body);

    if (!input) {
      return errorResponse("進捗登録リクエストが不正です。", 400);
    }

    const payload = await repository.addProgressLog(id, input);
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return errorResponse(error.message, error.statusCode);
    }

    if (isRepositoryError(error)) {
      return errorResponse(error.message, error.statusCode);
    }

    return errorResponse("進捗の登録に失敗しました。", 500);
  }
}
