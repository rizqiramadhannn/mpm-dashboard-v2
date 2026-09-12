"use client";

import { useId, useRef, useState } from "react";

type Supplier = { id: string; name: string };

export function SupplierPicker({ suppliers, value, onChange }: {
  suppliers: Supplier[];
  value: string;
  onChange: (id: string) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const previousSelection = useRef(value);
  const selected = suppliers.find(supplier => supplier.id === value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const results = suppliers.filter(supplier => supplier.name.toLocaleLowerCase("id-ID").includes(query.trim().toLocaleLowerCase("id-ID")));

  function choose(supplier: Supplier) {
    onChange(supplier.id);
    previousSelection.current = supplier.id;
    setQuery("");
    setOpen(false);
    setActive(-1);
    input.current?.setCustomValidity("");
  }

  return (
    <div className="manual-supplier-picker">
      <label htmlFor={id}>Supplier <span className="manual-required">*</span></label>
      <div className="manual-picker-input">
        <input
          id={id}
          ref={input}
          data-supplier-input
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
          autoComplete="off"
          required
          placeholder="Cari dan pilih supplier…"
          value={selected?.name ?? query}
          onFocus={event => {
            if (value) { setQuery(""); previousSelection.current = value; }
            setOpen(true); setActive(-1);
            event.currentTarget.setCustomValidity(value ? "" : "Pilih supplier dari daftar.");
          }}
          onClick={() => { setOpen(true); setActive(-1); }}
          onBlur={() => { setOpen(false); setActive(-1); }}
          onChange={event => {
            if (value) previousSelection.current = value;
            setQuery(event.target.value); setOpen(true); setActive(-1);
            onChange("");
            event.currentTarget.setCustomValidity("Pilih supplier dari hasil pencarian.");
          }}
          onKeyDown={event => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              const next = results.length ? event.key === "ArrowDown" ? (active + 1) % results.length : active <= 0 ? results.length - 1 : active - 1 : -1;
              setActive(next);
              document.getElementById(`${id}-option-${next}`)?.scrollIntoView({ block: "nearest" });
            } else if (event.key === "Enter" && open) {
              event.preventDefault();
              const candidate = results[active] ?? (results.length === 1 ? results[0] : undefined);
              if (candidate) choose(candidate);
            } else if (event.key === "Escape") {
              event.preventDefault(); setOpen(false); setQuery(""); setActive(-1);
              if (previousSelection.current) {
                onChange(previousSelection.current);
                input.current?.setCustomValidity("");
              }
            } else if (event.key === "Tab") {
              const candidate = results[active] ?? (results.length === 1 && query ? results[0] : undefined);
              if (open && candidate) choose(candidate);
            }
          }}
        />
        <span aria-hidden="true">⌄</span>
      </div>
      {open && (
        <div className="manual-picker-menu">
          <ul id={`${id}-options`} role="listbox" aria-label="Hasil pencarian supplier">
            {results.map((supplier, index) => (
              <li key={supplier.id} id={`${id}-option-${index}`} role="option" aria-selected={supplier.id === value} className={active === index ? "is-active" : ""} onMouseDown={event => event.preventDefault()} onClick={() => choose(supplier)}>
                <span>{supplier.name}</span>{supplier.id === value && <span aria-hidden="true">✓</span>}
              </li>
            ))}
          </ul>
          {!results.length && <p role="status">{suppliers.length ? "Supplier tidak ditemukan." : "Belum ada supplier di master."}</p>}
        </div>
      )}
    </div>
  );
}
