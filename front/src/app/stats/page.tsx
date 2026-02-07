"use client";

import { useEffect, useMemo, useState } from "react";
import { OrganicShell } from "@/components/organic-shell";
import { FORMAT_LABELS, STATUS_LABELS, STATUS_ORDER } from "@/lib/constants";
import { computeWeeklySummary } from "@/lib/helpers";
import { repository } from "@/lib/repository-instance";
import { Book, ProgressLog } from "@/lib/types";

const toPercent = (value: number): number => Math.round(value * 1000) / 10;

export default function StatsPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const loadedBooks = await repository.listBooks();
        const logsByBook = await Promise.all(
          loadedBooks.map(async (book) => repository.listProgressLogs(book.id))
        );
        setBooks(loadedBooks);
        setLogs(logsByBook.flat());
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "統計データの読み込みに失敗しました。";
        setErrorMessage(message);
      }
    };

    void load();
  }, []);

  const weeklySummary = useMemo(() => computeWeeklySummary(books, logs), [books, logs]);

  const statusCounts = useMemo(() => {
    const counts = {
      not_started: 0,
      reading: 0,
      paused: 0,
      completed: 0,
    };

    for (const book of books) {
      counts[book.status] += 1;
    }

    return counts;
  }, [books]);

  const formatCounts = useMemo(() => {
    const counts = {
      paper: 0,
      ebook: 0,
      audio: 0,
    };

    for (const book of books) {
      counts[book.format] += 1;
    }

    return counts;
  }, [books]);

  const completionRate = useMemo(() => {
    if (books.length === 0) {
      return 0;
    }
    return toPercent(statusCounts.completed / books.length);
  }, [books.length, statusCounts.completed]);

  return (
    <OrganicShell
      title="統計レポート"
      subtitle="読書進捗を可視化"
      contentTestId="stats-page"
      headerSearchPlaceholder="統計を検索..."
    >
      {errorMessage && <p className="notice-danger p-3 text-sm">{errorMessage}</p>}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="panel-soft p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--foreground)]/45">
            登録書籍数
          </p>
          <p className="mt-2 text-4xl font-bold text-[color:var(--foreground)]">{books.length}</p>
        </article>

        <article className="panel-soft p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--foreground)]/45">
            完読率
          </p>
          <p className="mt-2 text-4xl font-bold text-[color:var(--foreground)]">
            {completionRate}%
          </p>
        </article>

        <article className="panel-soft p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--foreground)]/45">
            今週の進捗記録
          </p>
          <p className="mt-2 text-4xl font-bold text-[color:var(--foreground)]">
            {weeklySummary.progressCount}
          </p>
        </article>

        <article className="panel-soft p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--foreground)]/45">
            今週の読了ページ
          </p>
          <p className="mt-2 text-4xl font-bold text-[color:var(--foreground)]">
            {weeklySummary.readPages}
          </p>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <article className="panel-card p-6">
          <h2 className="text-2xl font-bold text-[color:var(--foreground)]">ステータス分布</h2>
          <div className="mt-5 space-y-3">
            {STATUS_ORDER.map((status) => {
              const count = statusCounts[status];
              const ratio = books.length === 0 ? 0 : Math.round((count / books.length) * 100);

              return (
                <div key={status} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-[color:var(--foreground)]/82">
                      {STATUS_LABELS[status]}
                    </span>
                    <span className="text-[color:var(--foreground)]/62">
                      {count}冊 ({ratio}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[color:var(--background-soft)]">
                    <div
                      className="h-2 rounded-full bg-[color:var(--accent)] transition-all"
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="panel-card p-6">
          <h2 className="text-2xl font-bold text-[color:var(--foreground)]">読書形式の内訳</h2>
          <div className="mt-5 space-y-3">
            {Object.entries(formatCounts).map(([format, count]) => {
              const typedFormat = format as keyof typeof formatCounts;
              const ratio = books.length === 0 ? 0 : Math.round((count / books.length) * 100);

              return (
                <div key={format} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-[color:var(--foreground)]/82">
                      {FORMAT_LABELS[typedFormat]}
                    </span>
                    <span className="text-[color:var(--foreground)]/62">
                      {count}冊 ({ratio}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[color:var(--background-soft)]">
                    <div
                      className="h-2 rounded-full bg-[#3d405b]/75 transition-all"
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <article className="panel-subtle p-4">
          <p className="text-xs text-[color:var(--foreground)]/55">直近7日の感想数</p>
          <p className="mt-1 text-2xl font-bold text-[color:var(--foreground)]">
            {weeklySummary.reflectionCount}
          </p>
        </article>
        <article className="panel-subtle p-4">
          <p className="text-xs text-[color:var(--foreground)]/55">読書中の冊数</p>
          <p className="mt-1 text-2xl font-bold text-[color:var(--foreground)]">
            {statusCounts.reading}
          </p>
        </article>
        <article className="panel-subtle p-4">
          <p className="text-xs text-[color:var(--foreground)]/55">保留中の冊数</p>
          <p className="mt-1 text-2xl font-bold text-[color:var(--foreground)]">
            {statusCounts.paused}
          </p>
        </article>
      </section>
    </OrganicShell>
  );
}
