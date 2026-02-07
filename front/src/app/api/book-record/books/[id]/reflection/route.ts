import { NextRequest, NextResponse } from "next/server";
import { ReflectionInput } from "@/lib/types";
import { isAuthGuardError, requireAuthenticatedUser } from "@/lib/server/auth-guard";
import {
  isRepositoryError,
  PrismaBookRecordRepository,
} from "@/lib/server/prisma-book-record-repository";

const repository = new PrismaBookRecordRepository();

const parseReflectionInput = (body: unknown): ReflectionInput | null => {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;

  if (
    typeof candidate.learning !== "string" ||
    typeof candidate.action !== "string" ||
    typeof candidate.quote !== "string"
  ) {
    return null;
  }

  return {
    learning: candidate.learning,
    action: candidate.action,
    quote: candidate.quote,
  };
};

const errorResponse = (message: string, status: number): NextResponse => {
  return NextResponse.json({ message }, { status });
};

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: NextRequest, context: Params) {
  try {
    await requireAuthenticatedUser(request);
    const { id } = await context.params;
    const body = await request.json();
    const input = parseReflectionInput(body);

    if (!input) {
      return errorResponse("感想保存リクエストが不正です。", 400);
    }

    const book = await repository.saveReflection(id, input);
    return NextResponse.json({ book });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return errorResponse(error.message, error.statusCode);
    }

    if (isRepositoryError(error)) {
      return errorResponse(error.message, error.statusCode);
    }

    return errorResponse("感想の保存に失敗しました。", 500);
  }
}
