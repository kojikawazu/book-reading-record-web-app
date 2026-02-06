"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { OrganicShell } from "@/components/organic-shell";
import { FORMAT_LABELS, STATUS_LABELS } from "@/lib/constants";
import { reflectionIsMissing } from "@/lib/helpers";
import { repository } from "@/lib/repository-instance";
import { Book, BookStatus, ProgressLog } from "@/lib/types";
import { validateProgressForm, ValidationErrors } from "@/lib/validation";

const toProgressRate = (book: Book): number => {
  if (book.totalPages <= 0) {
    return 0;
  }
  return Math.round((book.currentPage / book.totalPages) * 1000) / 10;
};

export default function BookDetailPage() {
  const params = useParams<{ id: string }>();
  const bookId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [book, setBook] = useState<Book | null>(null);
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const [page, setPage] = useState("0");
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState<BookStatus>("not_started");

  const [learning, setLearning] = useState("");
  const [action, setAction] = useState("");
  const [quote, setQuote] = useState("");

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [saveMessage, setSaveMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const showReflectionForm = useMemo(() => {
    if (!book) {
      return false;
    }

    const parsedPage = Number(page);
    if (!Number.isFinite(parsedPage)) {
      return book.status === "completed";
    }

    return parsedPage >= book.totalPages || status === "completed" || book.status === "completed";
  }, [book, page, status]);

  const load = async () => {
    if (!bookId) {
      return;
    }

    try {
      const target = await repository.getBook(bookId);
      if (!target) {
        setBook(null);
        setLogs([]);
        return;
      }

      const targetLogs = await repository.listProgressLogs(bookId);

      setBook(target);
      setLogs(targetLogs);
      setPage(String(target.currentPage));
      setStatus(target.status);
      setMemo("");
      setLearning(target.reflection?.learning ?? "");
      setAction(target.reflection?.action ?? "");
      setQuote(target.reflection?.quote ?? "");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "書籍の読み込みに失敗しました。");
    } finally {
      setIsLoaded(true);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  const handleSaveProgress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!book) {
      return;
    }

    const parsedPage = Number(page);
    const formErrors = validateProgressForm({
      page: parsedPage,
      totalPages: book.totalPages,
      status,
      memo,
    });

    setErrors(formErrors);
    setSaveMessage("");
    setErrorMessage("");

    if (Object.keys(formErrors).length > 0) {
      return;
    }

    setSaving(true);

    try {
      const { book: updatedBook } = await repository.addProgressLog(book.id, {
        page: parsedPage,
        memo,
        status,
      });

      if (updatedBook.status === "completed") {
        await repository.saveReflection(book.id, {
          learning,
          action,
          quote,
        });
      }

      await load();
      setSaveMessage("保存しました。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  const handleReread = async () => {
    if (!book) {
      return;
    }

    setErrorMessage("");
    setSaveMessage("");

    try {
      await repository.updateBook(book.id, {
        status: "reading",
        currentPage: 0,
        completedAt: undefined,
      });

      await load();
      setSaveMessage("再読を開始しました。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "再読開始に失敗しました。");
    }
  };

  if (!isLoaded) {
    return (
      <OrganicShell
        title="書籍詳細"
        subtitle="読み込み中"
        contentTestId="book-detail-page"
        action={
          <Link href="/" className="btn-secondary px-4 py-2 text-sm">
            ダッシュボードへ戻る
          </Link>
        }
      >
        <div className="panel-soft p-4">
          <p className="text-sm text-[color:var(--foreground)]/65">読み込み中...</p>
        </div>
      </OrganicShell>
    );
  }

  if (!book) {
    return (
      <OrganicShell
        title="書籍詳細"
        subtitle="対象データを確認できません"
        contentTestId="book-detail-page"
        action={
          <Link href="/" className="btn-secondary inline-flex px-4 py-2 text-sm">
            ダッシュボードへ戻る
          </Link>
        }
      >
        <div className="space-y-4">
          <p data-testid="book-not-found" className="notice-danger p-3 text-sm">
            書籍が見つかりません。
          </p>
        </div>
      </OrganicShell>
    );
  }

  return (
    <OrganicShell
      title={book.title}
      subtitle="進捗記録と完読メモ"
      contentTestId="book-detail-page"
      action={
        <>
          <Link href="/" className="btn-secondary inline-flex px-4 py-2 text-sm">
            ダッシュボードへ戻る
          </Link>
          {book.status === "completed" && (
            <button
              type="button"
              data-testid="reread-button"
              onClick={handleReread}
              className="btn-secondary px-4 py-2 text-sm"
            >
              再読開始
            </button>
          )}
        </>
      }
    >
      <section className="panel-card p-5 md:p-6">
        <h2
          data-testid="book-title"
          className="text-3xl font-bold tracking-tight text-[color:var(--foreground)]"
        >
          {book.title}
        </h2>
        <p className="text-sm text-[color:var(--foreground)]/68">{book.author}</p>
        <p className="mt-3 text-sm text-[color:var(--foreground)]/80">
          {FORMAT_LABELS[book.format]} / ステータス: {STATUS_LABELS[book.status]}
        </p>
        <p className="text-sm text-[color:var(--foreground)]/80">
          {book.currentPage} / {book.totalPages} ({toProgressRate(book)}%)
        </p>
        <p className="mt-2 inline-flex rounded-full bg-[color:var(--background-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--foreground)]/76">
          感想状態: {reflectionIsMissing(book) ? "未記入" : "記入済み"}
        </p>
      </section>

      <form
        data-testid="progress-form"
        onSubmit={handleSaveProgress}
        className="panel-soft space-y-4 p-5"
      >
        <h2 className="text-lg font-semibold text-[color:var(--foreground)]">進捗記録</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="page" className="text-sm font-medium text-[color:var(--foreground)]/80">
              到達ページ
            </label>
            <input
              id="page"
              data-testid="progress-page-input"
              type="number"
              value={page}
              onChange={(event) => setPage(event.target.value)}
              className="field-input"
            />
            {errors.page && (
              <p data-testid="error-page" className="text-sm text-[color:var(--danger-text)]">
                {errors.page}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label
              htmlFor="status"
              className="text-sm font-medium text-[color:var(--foreground)]/80"
            >
              ステータス
            </label>
            <select
              id="status"
              data-testid="progress-status-select"
              value={status}
              onChange={(event) => setStatus(event.target.value as BookStatus)}
              className="field-select"
            >
              <option value="not_started">{STATUS_LABELS.not_started}</option>
              <option value="reading">{STATUS_LABELS.reading}</option>
              <option value="paused">{STATUS_LABELS.paused}</option>
              <option value="completed">{STATUS_LABELS.completed}</option>
            </select>
            {errors.status && (
              <p data-testid="error-status" className="text-sm text-[color:var(--danger-text)]">
                {errors.status}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="memo" className="text-sm font-medium text-[color:var(--foreground)]/80">
            メモ
          </label>
          <textarea
            id="memo"
            data-testid="progress-memo-input"
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            rows={3}
            className="field-textarea"
          />
          {errors.memo && (
            <p data-testid="error-memo" className="text-sm text-[color:var(--danger-text)]">
              {errors.memo}
            </p>
          )}
        </div>

        {showReflectionForm && (
          <section data-testid="reflection-form" className="panel-subtle space-y-3 p-4">
            <h3 className="text-base font-semibold text-[color:var(--foreground)]">
              完読時感想（空入力可）
            </h3>
            <div className="space-y-1">
              <label
                htmlFor="learning"
                className="text-sm font-medium text-[color:var(--foreground)]/80"
              >
                学び
              </label>
              <textarea
                id="learning"
                data-testid="reflection-learning-input"
                value={learning}
                onChange={(event) => setLearning(event.target.value)}
                rows={2}
                className="field-textarea"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="action"
                className="text-sm font-medium text-[color:var(--foreground)]/80"
              >
                次に行動すること
              </label>
              <textarea
                id="action"
                data-testid="reflection-action-input"
                value={action}
                onChange={(event) => setAction(event.target.value)}
                rows={2}
                className="field-textarea"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="quote"
                className="text-sm font-medium text-[color:var(--foreground)]/80"
              >
                印象に残った一文
              </label>
              <textarea
                id="quote"
                data-testid="reflection-quote-input"
                value={quote}
                onChange={(event) => setQuote(event.target.value)}
                rows={2}
                className="field-textarea"
              />
            </div>
          </section>
        )}

        {saveMessage && (
          <p data-testid="save-message" className="notice-success p-3 text-sm">
            {saveMessage}
          </p>
        )}

        {errorMessage && (
          <p data-testid="detail-error" className="notice-danger p-3 text-sm">
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          data-testid="progress-save-button"
          disabled={saving}
          className="btn-primary inline-flex w-full justify-center px-4 py-2.5 text-sm disabled:opacity-60"
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </form>

      <section data-testid="progress-logs" className="panel-soft space-y-3 p-5">
        <h2 className="text-lg font-semibold text-[color:var(--foreground)]">進捗履歴</h2>
        {logs.length === 0 ? (
          <p
            data-testid="progress-logs-empty"
            className="text-sm text-[color:var(--foreground)]/65"
          >
            進捗履歴はまだありません。
          </p>
        ) : (
          <ul className="space-y-2">
            {logs.map((log) => (
              <li
                key={log.id}
                data-testid={`progress-log-${log.id}`}
                className="panel-subtle p-3 text-sm"
              >
                <p>
                  {new Date(log.loggedAt).toLocaleString()} / {log.page}ページ /{" "}
                  {STATUS_LABELS[log.status]}
                </p>
                <p className="text-[color:var(--foreground)]/70">{log.memo ?? "(メモなし)"}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </OrganicShell>
  );
}
