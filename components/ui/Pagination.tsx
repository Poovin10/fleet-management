"use client";

import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: (number | "ellipsis")[] = [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);

    if (page > 4) pages.push("ellipsis");

    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);

    for (let i = start; i <= end; i++) pages.push(i);

    if (page < totalPages - 3) pages.push("ellipsis");

    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-1.5 border-t border-border-subtle px-4 py-3">
      <Button
        type="button"
        variant="glass"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="h-8 px-3 text-[11px]"
      >
        Previous
      </Button>

      {pages.map((item, index) =>
        item === "ellipsis" ? (
          <span
            key={`ellipsis-${index}`}
            className="px-1.5 text-xs text-fg-muted"
          >
            …
          </span>
        ) : (
          <Button
            key={item}
            type="button"
            variant={item === page ? "default" : "glass"}
            size="sm"
            onClick={() => onPageChange(item)}
            className={`h-8 min-w-8 px-2 text-[11px] ${
              item === page ? "shadow-[0_0_18px_rgba(255,159,10,.18)]" : ""
            }`}
          >
            {item}
          </Button>
        )
      )}

      <Button
        type="button"
        variant="glass"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="h-8 px-3 text-[11px]"
      >
        Next
      </Button>
    </div>
  );
}
