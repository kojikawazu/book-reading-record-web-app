import {
  Book,
  CreateBookInput,
  CreateProgressLogInput,
  ProgressLog,
  ReflectionInput,
  UpdateBookInput,
} from "./types";

export interface BookRepository {
  listBooks(): Promise<Book[]>;
  getBook(bookId: string): Promise<Book | null>;
  listProgressLogs(bookId: string): Promise<ProgressLog[]>;
  createBook(input: CreateBookInput): Promise<Book>;
  updateBook(bookId: string, patch: UpdateBookInput): Promise<Book>;
  addProgressLog(
    bookId: string,
    input: CreateProgressLogInput
  ): Promise<{ book: Book; log: ProgressLog }>;
  saveReflection(bookId: string, input: ReflectionInput): Promise<Book>;
  searchBooks(query: string): Promise<Book[]>;
}
