"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { useThemeMode } from "@/app/providers";
import HealthStatus from "@/features/layout/HealthStatus";
import {
  GearIcon,
  ListIcon,
  LoginIcon,
  LogoutIcon,
  MoonIcon,
  RegisterIcon,
  SearchIcon,
  SunIcon,
} from "@/features/ui/icons";

export default function NavBar() {
  const { user, logout } = useAuth();
  const { mode, setMode } = useThemeMode();
  const router = useRouter();
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);

  const go = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  const isActive = (p: string) =>
    p === "/" ? pathname === "/" : pathname.startsWith(p);

  const initials = user ? user.username.slice(0, 2).toLowerCase() : "?";

  return (
    <header
      style={{
        height: 56,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg)",
        position: "sticky",
        top: 0,
        zIndex: 30,
      }}
    >
      <button
        onClick={() => go("/")}
        style={{
          display: "flex",
          alignItems: "center",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          padding: 0,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-.01em", color: "var(--text)" }}>
          ASEticle
        </span>
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
        {user && <HealthStatus />}

        <button
          aria-label="menu"
          onClick={() => setOpen((o) => !o)}
          className="icon-btn"
          style={{
            width: 32,
            height: 32,
            background: "var(--accent-soft-bg)",
            color: "var(--accent-soft-text)",
            fontSize: 12.5,
            fontWeight: 600,
          }}
        >
          {initials}
        </button>

        {open && (
          <>
            <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
            <div
              className="card"
              style={{
                position: "absolute",
                top: 46,
                right: 0,
                zIndex: 50,
                width: 224,
                borderRadius: 13,
                boxShadow: "0 16px 44px rgba(0,0,0,.4)",
                padding: 6,
              }}
            >
              <div
                style={{
                  padding: "9px 12px 6px",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: ".04em",
                  textTransform: "uppercase",
                  color: "var(--faint)",
                }}
              >
                {user ? `@${user.username}` : "メニュー"}
              </div>

              {user ? (
                <>
                  <MenuItem active={isActive("/")} onClick={() => go("/")} icon={<SearchIcon />} label="検索" />
                  <MenuItem active={isActive("/result")} onClick={() => go("/result")} icon={<ListIcon />} label="結果" />
                  <MenuItem active={isActive("/settings")} onClick={() => go("/settings")} icon={<GearIcon />} label="設定" />
                  <MenuItem
                    active={false}
                    onClick={async () => {
                      setOpen(false);
                      await logout();
                      router.push("/login");
                    }}
                    icon={<LogoutIcon />}
                    label="ログアウト"
                  />
                </>
              ) : (
                <>
                  <MenuItem active={isActive("/login")} onClick={() => go("/login")} icon={<LoginIcon />} label="ログイン" />
                  <MenuItem active={isActive("/register")} onClick={() => go("/register")} icon={<RegisterIcon />} label="登録" />
                </>
              )}

              <div style={{ height: 1, background: "var(--border)", margin: "6px 8px" }} />

              <div style={{ padding: "2px 8px 6px" }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: ".04em",
                    textTransform: "uppercase",
                    color: "var(--faint)",
                    padding: "5px 4px 8px",
                  }}
                >
                  カラーモード
                </div>
                <div
                  style={{
                    display: "flex",
                    padding: 3,
                    background: "var(--input)",
                    border: "1px solid var(--border)",
                    borderRadius: 999,
                  }}
                >
                  <button className={`seg-btn ${mode === "light" ? "active" : ""}`} onClick={() => setMode("light")}>
                    <SunIcon size={14} />ライト
                  </button>
                  <button className={`seg-btn ${mode === "dark" ? "active" : ""}`} onClick={() => setMode("dark")}>
                    <MoonIcon size={14} />ダーク
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

function MenuItem({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button className={`menu-item ${active ? "active" : ""}`} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}
