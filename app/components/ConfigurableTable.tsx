"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode, TableHTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from "react";
import { tablePreferenceCookie, validHiddenColumns } from "./tablePreferences";
import type { TableColumn, TablePreferences } from "./tablePreferences";

type HiddenUpdate = string[] | ((current: string[]) => string[]);
const PreferencesContext = createContext<{ preferences: TablePreferences; update: (tableId: string, hidden: HiddenUpdate) => void }>({ preferences: {}, update: () => {} });
const TableContext = createContext<{ hidden: string[]; visibleCount: number; reveal: (columnId: string) => void }>({ hidden: [], visibleCount: 1, reveal: () => {} });

export function TablePreferencesProvider({ scope, initialPreferences, children }: { scope: string; initialPreferences: TablePreferences; children: ReactNode }) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const latest = useRef(initialPreferences);
  const update = useCallback((tableId: string, updateHidden: HiddenUpdate) => {
    const hidden = typeof updateHidden === "function" ? updateHidden(latest.current[tableId] ?? []) : updateHidden;
    latest.current = { ...latest.current, [tableId]: hidden };
    setPreferences(latest.current);
    document.cookie = tablePreferenceCookie(scope, tableId, hidden, location.protocol === "https:");
  }, [scope]);
  return <PreferencesContext.Provider value={{ preferences, update }}>{children}</PreferencesContext.Provider>;
}

export function ConfigurableTable({ tableId, columns, children, ...props }: TableHTMLAttributes<HTMLTableElement> & { tableId: string; columns: TableColumn[] }) {
  const { preferences, update } = useContext(PreferencesContext);
  const hidden = validHiddenColumns(preferences[tableId] ?? [], columns);
  const visibleCount = columns.length - hidden.length;
  return <TableContext.Provider value={{ hidden, visibleCount, reveal: columnId => update(tableId, current => current.filter(id => id !== columnId)) }}>
    <table {...props} data-table-id={tableId} data-has-hidden-columns={hidden.length > 0 || undefined}>{children}</table>
  </TableContext.Provider>;
}

export function TableColumnPicker({ tableId, columns }: { tableId: string; columns: TableColumn[] }) {
  const { preferences, update } = useContext(PreferencesContext);
  const hidden = validHiddenColumns(preferences[tableId] ?? [], columns);
  const visibleCount = columns.length - hidden.length;
  const details = useRef<HTMLDetailsElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  useEffect(() => {
    if (!position) return;
    const close = () => { if (details.current) details.current.open = false; setPosition(null); };
    const outside = (event: PointerEvent) => { if (!details.current?.contains(event.target as Node)) close(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { close(); details.current?.querySelector("summary")?.focus(); } };
    const scroll = (event: Event) => { if (!(event.target instanceof Node) || !details.current?.contains(event.target)) close(); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", close);
    };
  }, [position]);
  return <div className="table-column-controls" data-column-picker-for={tableId}>
      <details ref={details} className="table-column-picker" onToggle={event => {
        if (!event.currentTarget.open) { setPosition(null); return; }
        const rect = event.currentTarget.querySelector("summary")!.getBoundingClientRect();
        const width = Math.min(320, window.innerWidth - 16);
        const below = window.innerHeight - rect.bottom - 14;
        const above = rect.top - 14;
        const flip = below < 140 && above > below;
        const maxHeight = Math.min(300, Math.max(80, flip ? above : below));
        setPosition({ width, maxHeight, left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)), top: flip ? rect.top - maxHeight - 6 : rect.bottom + 6 });
      }}>
        <summary className="secondary-button">Kolom</summary>
        <div className="table-column-options" role="group" aria-label="Kolom yang ditampilkan" style={{ ...position, display: position ? undefined : "none" }}>
          {columns.map(column => <label key={column.id}>
            <input type="checkbox" checked={!hidden.includes(column.id)} disabled={visibleCount === 1 && !hidden.includes(column.id)} onChange={event => update(tableId, event.target.checked ? hidden.filter(id => id !== column.id) : [...hidden, column.id])} />
            <span>{column.label}</span>
          </label>)}
          <button type="button" onClick={() => update(tableId, [])}>Tampilkan semua</button>
        </div>
      </details>
    </div>;
}

export function TableHeader({ columnId, ...props }: ThHTMLAttributes<HTMLTableCellElement> & { columnId: string }) {
  const { hidden } = useContext(TableContext);
  return <th {...props} data-column-id={columnId} data-column-hidden={hidden.includes(columnId) || undefined} />;
}

export function TableCell({ columnId, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { columnId: string }) {
  const { hidden, reveal } = useContext(TableContext);
  return <td {...props} data-column-id={columnId} data-column-hidden={hidden.includes(columnId) || undefined} onInvalidCapture={event => {
    props.onInvalidCapture?.(event);
    if (hidden.includes(columnId)) {
      event.preventDefault();
      reveal(columnId);
      const input = event.target as HTMLElement;
      requestAnimationFrame(() => {
        input.focus();
        if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement || input instanceof HTMLTextAreaElement) input.reportValidity();
      });
    }
  }} />;
}

export function TableSpanCell(props: TdHTMLAttributes<HTMLTableCellElement>) {
  const { visibleCount } = useContext(TableContext);
  return <td {...props} colSpan={visibleCount} data-table-span />;
}
