"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type SortDirection = "asc" | "desc";

function normalizeCellValue(value: string) {
  const trimmed = value.trim();
  const numeric = trimmed.replace(/[^\d,-]/g, "").replace(",", ".");

  if (/^-?\d+(\.\d+)?$/.test(numeric) && /\d/.test(trimmed)) {
    return Number(numeric);
  }

  const dateParts = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);

  if (dateParts) {
    const [, day, month, year] = dateParts;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return new Date(`${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`).getTime();
  }

  return trimmed.toLowerCase();
}

function compareValues(left: string, right: string, direction: SortDirection) {
  const normalizedLeft = normalizeCellValue(left);
  const normalizedRight = normalizeCellValue(right);
  const multiplier = direction === "asc" ? 1 : -1;

  if (typeof normalizedLeft === "number" && typeof normalizedRight === "number") {
    return (normalizedLeft - normalizedRight) * multiplier;
  }

  return String(normalizedLeft).localeCompare(String(normalizedRight), "id") * multiplier;
}

function setHeaderIndicators(table: HTMLTableElement, columnIndex: number, direction: SortDirection) {
  const headers = Array.from(table.tHead?.rows[0]?.cells ?? []);

  for (const [index, header] of headers.entries()) {
    header.setAttribute("aria-sort", index === columnIndex ? (direction === "asc" ? "ascending" : "descending") : "none");
    header.querySelector(".sort-indicator")?.remove();

    if (index === columnIndex) {
      const indicator = document.createElement("span");
      indicator.className = "sort-indicator";
      indicator.textContent = direction === "asc" ? "^" : "v";
      header.appendChild(indicator);
    }
  }
}

function sortTable(table: HTMLTableElement, columnIndex: number, direction: SortDirection) {
  const body = table.tBodies[0];

  if (!body) {
    return;
  }

  const rows = Array.from(body.rows);
  const sortableRows = rows.filter((row) => {
    const cell = row.cells[columnIndex];
    return cell && row.cells.length > columnIndex && !Array.from(row.cells).some((candidate) => candidate.colSpan > 1);
  });
  const staticRows = rows.filter((row) => !sortableRows.includes(row));

  sortableRows.sort((left, right) =>
    compareValues(left.cells[columnIndex]?.textContent ?? "", right.cells[columnIndex]?.textContent ?? "", direction)
  );

  body.replaceChildren(...sortableRows, ...staticRows);
  table.dataset.sortColumn = String(columnIndex);
  table.dataset.sortDirection = direction;
  setHeaderIndicators(table, columnIndex, direction);
}

function initializeTable(table: HTMLTableElement) {
  const headerRow = table.tHead?.rows[0];

  if (!headerRow || !table.tBodies[0]) {
    return;
  }

  if (table.dataset.sortableInitialized === "true") {
    sortTable(table, Number(table.dataset.sortColumn ?? 0), (table.dataset.sortDirection ?? "asc") as SortDirection);
    return;
  }

  table.dataset.sortableInitialized = "true";

  Array.from(headerRow.cells).forEach((header, columnIndex) => {
    header.classList.add("sortable-header");
    header.tabIndex = 0;
    header.setAttribute("role", "button");
    header.setAttribute("aria-sort", "none");

    const activate = () => {
      const currentColumn = Number(table.dataset.sortColumn ?? 0);
      const currentDirection = (table.dataset.sortDirection ?? "asc") as SortDirection;
      const nextDirection =
        currentColumn === columnIndex && currentDirection === "asc" ? "desc" : "asc";

      sortTable(table, columnIndex, nextDirection);
    };

    header.addEventListener("click", activate);
    header.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });
  });

  sortTable(table, 0, "asc");
}

export function TableSorter() {
  const pathname = usePathname();

  useEffect(() => {
    const tables = Array.from(
      document.querySelectorAll<HTMLTableElement>("table[data-sortable-table]")
    );

    for (const table of tables) {
      initializeTable(table);
    }
  }, [pathname]);

  return null;
}
