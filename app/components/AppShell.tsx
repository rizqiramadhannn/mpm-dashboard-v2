"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavItem = {
  label: string;
  href: string;
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "List Invoice", href: "/invoice" },
  { label: "Pengiriman", href: "/pengiriman" },
];

const sphItems: NavItem[] = [
  { label: "Create SPH", href: "/sph/create" },
  { label: "List SPH", href: "/sph/list" },
];

const customerItems: NavItem[] = [
  { label: "Add new customer", href: "/customer/add-new-customer" },
  { label: "Customer list", href: "/customer/customer-list" },
];

const supplierItems: NavItem[] = [
  { label: "Add new supplier", href: "/supplier/add-new-supplier" },
  { label: "List supplier", href: "/supplier/supplier-list" },
  { label: "List nota supplier", href: "/supplier/nota-supplier" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const sphActive = pathname.startsWith("/sph");
  const customerActive = pathname.startsWith("/customer");
  const supplierActive = pathname.startsWith("/supplier");

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            M
          </div>
          <div>
            <p className="brand-title">MPM Sparepart</p>
            <p className="brand-subtitle">Sales Dashboard</p>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.slice(0, 1).map((item) => (
            <Link
              className={`nav-link ${isActive(pathname, item.href) ? "active" : ""}`}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}

          <div className="nav-group">
            <div className={`nav-group-label ${sphActive ? "active" : ""}`}>SPH</div>
            <div className="nav-children">
              {sphItems.map((item) => (
                <Link
                  className={`nav-link child ${isActive(pathname, item.href) ? "active" : ""}`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="nav-group">
            <div className={`nav-group-label ${customerActive ? "active" : ""}`}>Customer</div>
            <div className="nav-children">
              {customerItems.map((item) => (
                <Link
                  className={`nav-link child ${isActive(pathname, item.href) ? "active" : ""}`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="nav-group">
            <div className={`nav-group-label ${supplierActive ? "active" : ""}`}>
              SUPPLIER
            </div>
            <div className="nav-children">
              {supplierItems.map((item) => (
                <Link
                  className={`nav-link child ${isActive(pathname, item.href) ? "active" : ""}`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {navItems.slice(1).map((item) => (
            <Link
              className={`nav-link ${isActive(pathname, item.href) ? "active" : ""}`}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="main-content">{children}</main>
    </div>
  );
}
