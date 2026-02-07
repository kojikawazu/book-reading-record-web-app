"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthRequiredPanel } from "@/components/auth-required-panel";
import { GlobalLoadingScreen } from "@/components/global-loading-screen";
import { OrganicShell } from "@/components/organic-shell";
import { FORMAT_LABELS, STATUS_LABELS } from "@/lib/constants";
import { repository } from "@/lib/repository-instance";
import { BookFormat, BookStatus } from "@/lib/types";
import { useAuthSession } from "@/lib/use-auth-session";
import { normalizeTags, validateBookForm, ValidationErrors } from "@/lib/validation";

export default function NewBookPage() {
  const router = useRouter();
  const { authRequired, loading: authLoading, isAuthenticated, configError } = useAuthSession();

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [genre, setGenre] = useState("");
  const [format, setFormat] = useState<BookFormat>("paper");
  const [totalPages, setTotalPages] = useState("0");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<BookStatus>("not_started");
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (authRequired && !isAuthenticated) {
      return;
    }

    const parsedTotalPages = Number(totalPages);
    const normalizedTags = normalizeTags(tags);

    const validationErrors = validateBookForm({
      title,
      author,
      genre,
      totalPages: parsedTotalPages,
      tags: normalizedTags,
      status,
    });

    setErrors(validationErrors);
    setFormError("");

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSaving(true);
    try {
      await repository.createBook({
        title,
        author,
        genre,
        format,
        totalPages: parsedTotalPages,
        tags: normalizedTags,
        status: status === "completed" ? "not_started" : status,
      });

      router.push("/");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "書籍の保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  if (authRequired && authLoading) {
    return <GlobalLoadingScreen message="認証状態を確認しています..." />;
  }

  if (authRequired && !authLoading && !isAuthenticated) {
    return (
      <OrganicShell
        title="書籍登録"
        subtitle="新しい読書対象を記録します"
        contentTestId="new-book-page"
        action={
          <Link href="/" data-testid="book-cancel-link" className="btn-secondary px-4 py-2 text-sm">
            ダッシュボードへ戻る
          </Link>
        }
      >
        <AuthRequiredPanel nextPath="/books/new" configError={configError} />
      </OrganicShell>
    );
  }

  return (
    <OrganicShell
      title="書籍登録"
      subtitle="新しい読書対象を記録します"
      contentTestId="new-book-page"
      action={
        <Link href="/" data-testid="book-cancel-link" className="btn-secondary px-4 py-2 text-sm">
          ダッシュボードへ戻る
        </Link>
      }
    >
      <form
        data-testid="new-book-form"
        onSubmit={handleSubmit}
        noValidate
        className="panel-card mx-auto w-full max-w-3xl space-y-6 p-6 md:p-8"
      >
        <div className="space-y-2">
          <label htmlFor="title" className="text-sm font-medium text-[color:var(--foreground)]/80">
            タイトル
          </label>
          <input
            id="title"
            data-testid="book-title-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="field-input"
          />
          {errors.title && (
            <p data-testid="error-title" className="text-sm text-[color:var(--danger-text)]">
              {errors.title}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="author" className="text-sm font-medium text-[color:var(--foreground)]/80">
            著者
          </label>
          <input
            id="author"
            data-testid="book-author-input"
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
            className="field-input"
          />
          {errors.author && (
            <p data-testid="error-author" className="text-sm text-[color:var(--danger-text)]">
              {errors.author}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="genre" className="text-sm font-medium text-[color:var(--foreground)]/80">
            ジャンル
          </label>
          <input
            id="genre"
            data-testid="book-genre-input"
            value={genre}
            onChange={(event) => setGenre(event.target.value)}
            className="field-input"
          />
          {errors.genre && (
            <p data-testid="error-genre" className="text-sm text-[color:var(--danger-text)]">
              {errors.genre}
            </p>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="format"
              className="text-sm font-medium text-[color:var(--foreground)]/80"
            >
              読書形式
            </label>
            <select
              id="format"
              data-testid="book-format-select"
              value={format}
              onChange={(event) => setFormat(event.target.value as BookFormat)}
              className="field-select"
            >
              {Object.entries(FORMAT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="totalPages"
              className="text-sm font-medium text-[color:var(--foreground)]/80"
            >
              総ページ数
            </label>
            <input
              id="totalPages"
              data-testid="book-total-pages-input"
              type="number"
              min={1}
              value={totalPages}
              onChange={(event) => setTotalPages(event.target.value)}
              className="field-input"
            />
            {errors.totalPages && (
              <p
                data-testid="error-total-pages"
                className="text-sm text-[color:var(--danger-text)]"
              >
                {errors.totalPages}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="tags" className="text-sm font-medium text-[color:var(--foreground)]/80">
            タグ（カンマ区切り）
          </label>
          <input
            id="tags"
            data-testid="book-tags-input"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            className="field-input"
          />
          {errors.tags && (
            <p data-testid="error-tags" className="text-sm text-[color:var(--danger-text)]">
              {errors.tags}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="status" className="text-sm font-medium text-[color:var(--foreground)]/80">
            初期ステータス
          </label>
          <select
            id="status"
            data-testid="book-status-select"
            value={status}
            onChange={(event) => setStatus(event.target.value as BookStatus)}
            className="field-select"
          >
            <option value="not_started">{STATUS_LABELS.not_started}</option>
            <option value="reading">{STATUS_LABELS.reading}</option>
            <option value="paused">{STATUS_LABELS.paused}</option>
          </select>
        </div>

        {formError && (
          <p data-testid="new-book-form-error" className="notice-danger p-3 text-sm">
            {formError}
          </p>
        )}

        <button
          type="submit"
          data-testid="book-save-button"
          disabled={saving}
          className="btn-primary inline-flex w-full justify-center px-4 py-2.5 text-sm disabled:opacity-60"
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </form>
    </OrganicShell>
  );
}
