"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavItem = {
  label: string;
  href: string;
};

const sphItems: NavItem[] = [
  { label: "CREATE SPH", href: "/sph/create" },
  { label: "LIST SPH", href: "/sph/list" },
];

const customerItems: NavItem[] = [
  { label: "ADD NEW CUSTOMER", href: "/customer/add-new-customer" },
  { label: "CUSTOMER LIST", href: "/customer/customer-list" },
];

const supplierItems: NavItem[] = [
  { label: "ADD NEW SUPPLIER", href: "/supplier/add-new-supplier" },
  { label: "LIST SUPPLIER", href: "/supplier/supplier-list" },
  { label: "LIST NOTA SUPPLIER", href: "/supplier/nota-supplier" },
];

const assetItems: NavItem[] = [
  { label: "ADD NEW ASSET", href: "/asset/add-new-asset" },
  { label: "ASSET LIST", href: "/asset/asset-list" },
];

const inventoryUrl =
  "https://docs.google.com/spreadsheets/d/1YokPzd8cGFmHoN1xLvNaA-o-mDbt2A6sRqPkll7GHNY/edit?gid=1188437955#gid=1188437955&fvid=2137505468";

const appVersion = "1.0.0";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const sphActive = pathname.startsWith("/sph");
  const customerActive = pathname.startsWith("/customer");
  const supplierActive = pathname.startsWith("/supplier");
  const assetActive = pathname.startsWith("/asset");

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt=""
              src="/sph-assets/mpm-logo-source.png"
            />
          </div>
          <div>
            <p className="brand-title">MOROWALI PUTRA MANDIRI</p>
            <p className="brand-subtitle">General Trading</p>
          </div>
        </div>

        <nav className="nav-list">
          <Link
            className={`nav-link ${isActive(pathname, "/dashboard") ? "active" : ""}`}
            href="/dashboard"
          >
            DASHBOARD
          </Link>

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

          <Link
            className={`nav-link ${isActive(pathname, "/pengiriman") ? "active" : ""}`}
            href="/pengiriman"
          >
            PENGIRIMAN
          </Link>

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

          <div className="nav-group">
            <div className={`nav-group-label ${customerActive ? "active" : ""}`}>CUSTOMER</div>
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

          <Link
            className={`nav-link ${isActive(pathname, "/invoice") ? "active" : ""}`}
            href="/invoice"
          >
            INVOICE
          </Link>

          <Link
            className={`nav-link ${isActive(pathname, "/payment-request") ? "active" : ""}`}
            href="/payment-request"
          >
            PAYMENT REQUEST
          </Link>

          <Link
            className={`nav-link ${isActive(pathname, "/workspace") ? "active" : ""}`}
            href="/workspace"
          >
            WORKSPACE
          </Link>

          <Link
            className={`nav-link ${isActive(pathname, "/bbr") ? "active" : ""}`}
            href="/bbr"
          >
            BBR
          </Link>

          <Link
            className={`nav-link ${isActive(pathname, "/admin/users") ? "active" : ""}`}
            href="/admin/users"
          >
            ADMIN USERS
          </Link>

          <a
            className="nav-link"
            href={inventoryUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            INVENTORY
          </a>

          <div className="nav-group">
            <div className={`nav-group-label ${assetActive ? "active" : ""}`}>ASSET</div>
            <div className="nav-children">
              {assetItems.map((item) => (
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
        </nav>

        <form action="/logout" method="post">
          <button className="logout-button" type="submit">
            LOGOUT
          </button>
        </form>
      </aside>

      <main className="main-content">
        <div className="main-content-body">{children}</div>
        <footer className="app-footer">
          <span>Copyright 2026 Rizqi Ramadhan all Rights Reserved</span>
          <span>Version {appVersion}</span>
        </footer>
      </main>
    </div>
  );
}
