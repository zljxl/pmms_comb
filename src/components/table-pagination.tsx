'use client';

import { useEffect, useState } from 'react';

export function useTablePagination<T>(items: T[], resetKey?: string) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => setPage(1), [pageSize, resetKey]);
  useEffect(() => setPage(current => Math.min(current, pageCount)), [pageCount]);

  const start = (page - 1) * pageSize;
  return {
    page,
    pageSize,
    pageCount,
    setPage,
    setPageSize,
    paginatedItems: items.slice(start, start + pageSize),
    start,
    paginationProps: { page, pageSize, pageCount, setPage, setPageSize },
  };
}

export function TablePagination({
  total,
  page,
  pageSize,
  pageCount,
  setPage,
  setPageSize,
}: {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
}) {
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, total);
  return (
    <div className="no-print mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs text-slate-600">
      <span>
        Exibindo {first}-{last} de {total} registros
      </span>
      <div className="flex items-center gap-2">
        <label className="mb-0 normal-case tracking-normal">Por página</label>
        <select
          value={pageSize}
          onChange={event => setPageSize(Number(event.target.value))}
          className="w-auto py-1.5"
        >
          {[10, 20, 50, 100].map(size => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          className="rounded-xl border border-slate-300 px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
        >
          Anterior
        </button>
        <span className="min-w-16 text-center font-medium">
          {page} de {pageCount}
        </span>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => setPage(page + 1)}
          className="rounded-xl border border-slate-300 px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
        >
          Próxima
        </button>
      </div>
    </div>
  );
}
