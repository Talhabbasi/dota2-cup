"use client";

import { useEffect, useMemo, useState } from "react";

export function usePagedList<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [items, pageSize]);

  const safePage = Math.min(page, pageCount);
  const slice = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, pageSize, safePage],
  );

  return { page: safePage, pageCount, slice, setPage };
}

function pageWindow(page: number, pageCount: number) {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const set = new Set([1, pageCount, page - 1, page, page + 1]);
  if (page <= 3) {
    set.add(2);
    set.add(3);
    set.add(4);
  }
  if (page >= pageCount - 2) {
    set.add(pageCount - 3);
    set.add(pageCount - 2);
    set.add(pageCount - 1);
  }
  return [...set].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
}

export function Pagination({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  const pages = pageWindow(page, pageCount);

  function go(next: number) {
    onPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <nav className="pagination" aria-label="Pages">
      <button
        type="button"
        className="pagination-btn"
        disabled={page <= 1}
        onClick={() => go(page - 1)}
      >
        Prev
      </button>
      {pages.map((n, i) => {
        const gap = i > 0 && n - pages[i - 1] > 1;
        return (
          <span key={n} className="pagination-cluster">
            {gap ? <span className="pagination-ellipsis">…</span> : null}
            <button
              type="button"
              className={n === page ? "pagination-btn is-active" : "pagination-btn"}
              aria-current={n === page ? "page" : undefined}
              onClick={() => go(n)}
            >
              {n}
            </button>
          </span>
        );
      })}
      <button
        type="button"
        className="pagination-btn"
        disabled={page >= pageCount}
        onClick={() => go(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
