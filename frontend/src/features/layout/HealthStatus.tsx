"use client";

import { useEffect, useState } from "react";
import { healthApi, HealthStatus as Health } from "@/lib/api";

const POLL_MS = 20000;

type Dot = "green" | "red" | "gray";

function dotColor(c: Dot): string {
  return c === "green" ? "var(--accent)" : c === "red" ? "var(--danger)" : "var(--faint)";
}

function Circle({ c, size = 7, glow = true }: { c: Dot; size?: number; glow?: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: dotColor(c),
        boxShadow: c === "green" && glow ? "0 0 6px var(--accent)" : "none",
      }}
    />
  );
}

export default function HealthStatus() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const h = await healthApi.status();
        if (alive) {
          setHealth(h);
          setError(false);
        }
      } catch {
        if (alive) setError(true);
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const egress = health?.egress;
  const overall: Dot = error ? "red" : !health ? "gray" : health.online ? "green" : "red";
  const statusText = error
    ? "オフライン"
    : !health
    ? "確認中"
    : health.online
    ? "オンライン"
    : "一部オフライン";

  return (
    <div
      style={{ position: "relative", display: "flex", alignItems: "center" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`システム状態: ${statusText}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="icon-btn"
        style={{ width: 16, height: 16, background: "transparent", padding: 0 }}
      >
        <Circle c={overall} />
      </button>
      {open && (
        <div
          className="card"
          style={{
            position: "absolute",
            top: 22,
            right: 0,
            zIndex: 60,
            width: 232,
            padding: 12,
            boxShadow: "0 16px 44px rgba(0,0,0,.35)",
          }}
        >
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", marginBottom: 9 }}>
            システム状態
          </div>
          {error ? (
            <div style={{ fontSize: 12, color: "var(--danger)" }}>バックエンドに接続できません</div>
          ) : !health ? (
            <div style={{ fontSize: 12, color: "var(--muted)" }}>確認中…</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <Row ok={health.backend} label="バックエンド API" />
              <Row ok={health.db} label="データベース" />
              <Row
                ok={!!egress?.online}
                label={`取得経路（${egress?.mode}）`}
                detail={egress?.detail}
              />
              {egress?.mode === "relay" && (
                <div style={{ fontSize: 11, color: "var(--faint)", paddingLeft: 15 }}>
                  agent: {egress?.agent_online ? "online" : "offline"}
                  {egress?.pending_jobs != null && ` · queue ${egress.pending_jobs}`}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Circle c={ok ? "green" : "red"} glow={false} />
      <span style={{ fontSize: 12, color: "var(--text)" }}>{label}</span>
      {detail && (
        <span style={{ fontSize: 11, color: "var(--faint)", marginLeft: "auto" }}>{detail}</span>
      )}
    </div>
  );
}
