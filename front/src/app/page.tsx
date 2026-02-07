"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { OrganicShell } from "@/components/organic-shell";
import { FORMAT_LABELS, STATUS_LABELS, STATUS_ORDER } from "@/lib/constants";
import { computeWeeklySummary, consumeRecoveryNotice, reflectionIsMissing } from "@/lib/helpers";
import { repository } from "@/lib/repository-instance";
import { Book, BookStatus, ProgressLog } from "@/lib/types";

const SECTION_CONFIG: Array<{ status: BookStatus; testId: string }> = [
  { status: "not_started", testId: "section-not-started" },
  { status: "reading", testId: "section-reading" },
  { status: "paused", testId: "section-paused" },
  { status: "completed", testId: "section-completed" },
];

type SectionTone = BookStatus | "pending_reflection";

const SECTION_TONE_CLASS: Record<SectionTone, string> = {
  not_started: "section-tone-not-started",
  reading: "section-tone-reading",
  paused: "section-tone-paused",
  completed: "section-tone-completed",
  pending_reflection: "section-tone-pending-reflection",
};

const SECTION_DOT_CLASS: Record<SectionTone, string> = {
  not_started: "section-dot-not-started",
  reading: "section-dot-reading",
  paused: "section-dot-paused",
  completed: "section-dot-completed",
  pending_reflection: "section-dot-pending-reflection",
};

const filterBooksByQuery = (books: Book[], query: string): Book[] => {
  const normalized = query.trim().toLocaleLowerCase();

  if (!normalized) {
    return books;
  }

  return books.filter((book) => {
    const combined = [book.title, book.author, ...(book.tags ?? [])].join(" ").toLocaleLowerCase();
    return combined.includes(normalized);
  });
};

const progressRate = (book: Book): number => {
  if (book.totalPages <= 0) {
    return 0;
  }

  return Math.round((book.currentPage / book.totalPages) * 1000) / 10;
};

const BookCard = ({ book }: { book: Book }) => {
  return (
    <Link
      href={`/books/${book.id}`}
      data-testid={`book-card-${book.id}`}
      className="panel-subtle block p-4 transition hover:-translate-y-0.5 hover:border-[color:var(--accent)]"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-base font-semibold text-[color:var(--foreground)]">{book.title}</p>
        <span className="rounded-full bg-[color:var(--background-soft)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--foreground)]/70">
          {STATUS_LABELS[book.status]}
        </span>
      </div>
      <p className="mt-1 text-sm text-[color:var(--foreground)]/70">{book.author}</p>
      <p className="mt-2 text-xs text-[color:var(--foreground)]/75">
        {FORMAT_LABELS[book.format]} / {book.currentPage} / {book.totalPages} ({progressRate(book)}
        %)
      </p>
      <p className="mt-1 text-xs text-[color:var(--foreground)]/55">
        最終更新: {new Date(book.updatedAt).toLocaleString()}
      </p>
    </Link>
  );
};

const Section = ({
  title,
  testId,
  books,
  tone,
}: {
  title: string;
  testId: string;
  books: Book[];
  tone: SectionTone;
}) => {
  return (
    <section data-testid={testId} className={`panel-soft ${SECTION_TONE_CLASS[tone]} space-y-3 p-5`}>
      <h2 className="flex items-center gap-2 text-lg font-semibold text-[color:var(--foreground)]">
        <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${SECTION_DOT_CLASS[tone]}`} />
        {title}
      </h2>
      {books.length === 0 ? (
        <p data-testid={`${testId}-empty`} className="text-sm text-[color:var(--foreground)]/60">
          データがありません。
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </section>
  );
};

export default function DashboardPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const loadedBooks = await repository.listBooks();
        const logsByBook = await Promise.all(
          loadedBooks.map(async (book) => repository.listProgressLogs(book.id))
        );
        setBooks(loadedBooks);
        setLogs(logsByBook.flat());
        setRecoveryNotice(consumeRecoveryNotice());
      } catch (error) {
        const message = error instanceof Error ? error.message : "データの読み込みに失敗しました。";
        setErrorMessage(message);
      } finally {
        setIsLoaded(true);
      }
    };

    void load();
  }, []);

  const validBooks = useMemo(() => books.filter((book) => book.totalPages > 0), [books]);
  const invalidBookCount = books.length - validBooks.length;

  const filteredBooks = useMemo(() => filterBooksByQuery(validBooks, query), [validBooks, query]);

  const booksByStatus = useMemo(() => {
    const map = new Map<BookStatus, Book[]>();
    for (const status of STATUS_ORDER) {
      map.set(
        status,
        filteredBooks.filter((book) => book.status === status)
      );
    }
    return map;
  }, [filteredBooks]);

  const pendingReflections = useMemo(() => {
    return filteredBooks.filter((book) => book.status === "completed" && reflectionIsMissing(book));
  }, [filteredBooks]);

  const weeklySummary = useMemo(() => computeWeeklySummary(validBooks, logs), [validBooks, logs]);

  const completedCount = useMemo(() => {
    return validBooks.filter((book) => book.status === "completed").length;
  }, [validBooks]);

  const badges = useMemo(() => {
    return [
      {
        id: "progress-streak",
        icon: "🗓️",
        label: "継続記録",
        condition: "今週3回以上の進捗記録",
        achieved: weeklySummary.progressCount >= 3,
      },
      {
        id: "page-hunter",
        icon: "📗",
        label: "ページハンター",
        condition: "今週100ページ以上を読了",
        achieved: weeklySummary.readPages >= 100,
      },
      {
        id: "reflection-writer",
        icon: "✍️",
        label: "感想投稿",
        condition: "今週1件以上の感想を保存",
        achieved: weeklySummary.reflectionCount >= 1,
      },
      {
        id: "first-complete",
        icon: "🏁",
        label: "完読達成",
        condition: "累計1冊以上を完読",
        achieved: completedCount >= 1,
      },
    ];
  }, [
    completedCount,
    weeklySummary.progressCount,
    weeklySummary.readPages,
    weeklySummary.reflectionCount,
  ]);

  return (
    <OrganicShell
      title="読書記録アプリ"
      subtitle="単一ユーザー向けMVP"
      contentTestId="dashboard-page"
    >
      <section className="relative overflow-hidden rounded-[48px] bg-[color:var(--accent)] p-8 text-white shadow-2xl shadow-[rgba(129,178,154,0.3)] md:p-12">
        <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/20 blur-xl" />
        <div className="absolute -bottom-12 right-[-20px] text-[160px] leading-none text-white/10">
          📘
        </div>
        <div className="relative max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">
            Reading Flow
          </p>
          <h2 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">
            素晴らしい読書体験を、
            <br />
            確かな成長へ。
          </h2>
          <p className="mt-4 text-sm text-white/85">
            完読・再読・感想までを一気通貫で管理し、記録を習慣化します。
          </p>
          <Link
            href="/books/new"
            data-testid="add-book-link"
            className="mt-6 inline-flex items-center rounded-full bg-white px-6 py-3 text-sm font-bold text-[color:var(--accent)] shadow-lg transition hover:-translate-y-0.5"
          >
            新しい記録を始める
          </Link>
        </div>
      </section>

      {!isLoaded ? (
        <section data-testid="dashboard-loading" className="panel-soft space-y-4 p-5">
          <p className="text-sm font-medium text-[color:var(--foreground)]/72">
            ダッシュボードデータを読み込み中です...
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-24 animate-pulse rounded-2xl bg-[color:var(--background-soft)]/70"
              />
            ))}
          </div>
        </section>
      ) : (
        <>
          {recoveryNotice && (
            <p data-testid="recovery-message" className="notice-warn p-3 text-sm">
              破損したデータを検知したため初期化し、バックアップを作成しました。
            </p>
          )}

          {errorMessage && (
            <p data-testid="dashboard-error" className="notice-danger p-3 text-sm">
              {errorMessage}
            </p>
          )}

          {invalidBookCount > 0 && (
            <p data-testid="invalid-book-warning" className="notice-danger p-3 text-sm">
              総ページ数が不正な書籍が {invalidBookCount} 件あるため表示対象から除外しました。
            </p>
          )}

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
            <div className="space-y-4 xl:col-span-2">
              <section className="panel-soft p-5">
                <label
                  htmlFor="search"
                  className="mb-2 block text-sm font-medium text-[color:var(--foreground)]/78"
                >
                  検索
                </label>
                <input
                  id="search"
                  data-testid="search-input"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="タイトル・著者・タグで検索"
                  className="field-input"
                />
              </section>

              <section
                data-testid="weekly-summary"
                className="panel-soft grid gap-3 p-4 sm:grid-cols-3"
              >
                <div className="panel-subtle px-3 py-3">
                  <p className="text-xs text-[color:var(--foreground)]/58">直近7日の読了ページ数</p>
                  <p
                    data-testid="weekly-read-pages"
                    className="text-2xl font-bold text-[color:var(--foreground)]"
                  >
                    {weeklySummary.readPages}
                  </p>
                </div>
                <div className="panel-subtle px-3 py-3">
                  <p className="text-xs text-[color:var(--foreground)]/58">直近7日の進捗記録回数</p>
                  <p
                    data-testid="weekly-progress-count"
                    className="text-2xl font-bold text-[color:var(--foreground)]"
                  >
                    {weeklySummary.progressCount}
                  </p>
                </div>
                <div className="panel-subtle px-3 py-3">
                  <p className="text-xs text-[color:var(--foreground)]/58">直近7日の感想数</p>
                  <p
                    data-testid="weekly-reflection-count"
                    className="text-2xl font-bold text-[color:var(--foreground)]"
                  >
                    {weeklySummary.reflectionCount}
                  </p>
                </div>
              </section>

              <div className="space-y-4">
                {SECTION_CONFIG.map((section) => (
                  <Section
                    key={section.status}
                    title={STATUS_LABELS[section.status]}
                    testId={section.testId}
                    books={booksByStatus.get(section.status) ?? []}
                    tone={section.status}
                  />
                ))}

                <Section
                  title="感想未記入"
                  testId="section-pending-reflection"
                  books={pendingReflections}
                  tone="pending_reflection"
                />
              </div>
            </div>

            <aside className="space-y-4">
              <section className="panel-soft p-6">
                <h3 className="flex items-center gap-2 text-lg font-bold">
                  <span className="text-base">🏅</span>
                  今週のバッジ
                </h3>
                <div className="mt-4 space-y-3">
                  {badges.map((badge) => (
                    <article
                      key={badge.id}
                      className={`rounded-2xl border p-3 ${
                        badge.achieved
                          ? "border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10"
                          : "border-[color:var(--border)] bg-white/70"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <span className="text-xl">{badge.icon}</span>
                          <div>
                            <p className="text-sm font-bold text-[color:var(--foreground)]">
                              {badge.label}
                            </p>
                            <p className="text-xs text-[color:var(--foreground)]/62">
                              {badge.condition}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                            badge.achieved
                              ? "bg-[color:var(--accent)] text-white"
                              : "bg-[color:var(--background-soft)] text-[color:var(--foreground)]/72"
                          }`}
                        >
                          {badge.achieved ? "達成" : "未達成"}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-[40px] bg-[#3d405b] p-6 text-white shadow-lg">
                <h3 className="text-lg font-bold">運用メモ</h3>
                <ul className="mt-4 space-y-2 text-sm text-white/85">
                  <li>完読時に感想を保存</li>
                  <li>再読時はページ0から再開</li>
                  <li>感想は再完読で再編集可能</li>
                </ul>
              </section>
            </aside>
          </div>
        </>
      )}
    </OrganicShell>
  );
}
