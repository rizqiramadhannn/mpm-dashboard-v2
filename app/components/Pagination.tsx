import Link from "next/link";

export const DEFAULT_PAGE_SIZE = 20;

export function getCurrentPage(params: Record<string, string | string[] | undefined>) {
  const value = params.page;
  const rawValue = Array.isArray(value) ? value[0] : value;
  const page = Number(rawValue ?? "1");

  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function paginateRows<T>(rows: T[], currentPage: number, pageSize = DEFAULT_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    pageRows: rows.slice(start, start + pageSize),
    safePage,
    totalPages,
  };
}

type PaginationProps = {
  currentPage: number;
  pageSize?: number;
  params?: Record<string, string | string[] | undefined>;
  totalItems: number;
};

function pageHref(page: number, params: Record<string, string | string[] | undefined>) {
  const queryParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (key === "page") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item) {
          queryParams.append(key, item);
        }
      }
    } else if (value) {
      queryParams.set(key, value);
    }
  }

  queryParams.set("page", String(page));

  return `?${queryParams.toString()}`;
}

export function Pagination({
  currentPage,
  pageSize = DEFAULT_PAGE_SIZE,
  params = {},
  totalItems,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalPages <= 1) {
    return (
      <div className="pagination-bar">
        <span>{totalItems} data</span>
      </div>
    );
  }

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  return (
    <div className="pagination-bar">
      <span>
        {startItem}-{endItem} dari {totalItems} data
      </span>
      <div className="pagination-actions">
        <Link
          aria-disabled={currentPage <= 1}
          className={currentPage <= 1 ? "disabled" : ""}
          href={pageHref(Math.max(1, currentPage - 1), params)}
        >
          Previous
        </Link>
        <span>
          Page {currentPage} / {totalPages}
        </span>
        <Link
          aria-disabled={currentPage >= totalPages}
          className={currentPage >= totalPages ? "disabled" : ""}
          href={pageHref(Math.min(totalPages, currentPage + 1), params)}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
