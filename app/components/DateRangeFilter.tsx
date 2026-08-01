"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";

type DateRangeFilterProps = {
  from?: string;
  label?: string;
  to?: string;
};

function parseDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toIsoDate(value?: Date) {
  if (!value) {
    return "";
  }

  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const date = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${date}`;
}

function formatDisplay(value?: Date) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export function DateRangeFilter({
  from,
  label = "Tanggal",
  to,
}: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLLabelElement>(null);
  const [range, setRange] = useState<DateRange | undefined>({
    from: parseDate(from),
    to: parseDate(to),
  });
  const fromValue = toIsoDate(range?.from);
  const toValue = toIsoDate(range?.to);
  const displayValue = useMemo(() => {
    if (range?.from && range?.to) {
      return `${formatDisplay(range.from)} - ${formatDisplay(range.to)}`;
    }

    if (range?.from) {
      return `${formatDisplay(range.from)} -`;
    }

    return "";
  }, [range]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (
        wrapperRef.current &&
        event.target instanceof Node &&
        !wrapperRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <label className="date-range-filter" ref={wrapperRef}>
      <span>{label}</span>
      <input name="from" type="hidden" value={fromValue} />
      <input name="to" type="hidden" value={toValue} />
      <button
        className="date-range-trigger"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {displayValue || "Pilih rentang tanggal"}
      </button>
      {open ? (
        <div className="date-range-popover">
          <DayPicker
            mode="range"
            numberOfMonths={2}
            onSelect={setRange}
            selected={range}
          />
          <div className="date-range-actions">
            <button
              onClick={() => {
                setRange(undefined);
                setOpen(false);
              }}
              type="button"
            >
              Clear
            </button>
            <button onClick={() => setOpen(false)} type="button">
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </label>
  );
}
