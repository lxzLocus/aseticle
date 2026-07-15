"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import NavBar from "@/features/layout/NavBar";
import { SearchIcon } from "@/features/ui/icons";

const SUGGESTIONS = ["拡散モデルのサンプリング", "RAG の最新研究", "Transformer 効率化"];

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  const submit = (q?: string) => {
    const text = (q ?? query).trim();
    if (text) router.push(`/result?query=${encodeURIComponent(text)}`);
  };

  if (loading || !user) return null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <NavBar />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 32px 100px" }}>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "var(--accent-soft-bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--accent)",
            marginBottom: 22,
          }}
        >
          <SearchIcon size={28} strokeWidth={2.2} />
        </div>
        <h1 style={{ margin: "0 0 9px", fontSize: 36, fontWeight: 600, letterSpacing: "-.025em", color: "var(--text)" }}>
          ASEticle
        </h1>
        <p style={{ margin: "0 0 32px", fontSize: 14.5, color: "var(--muted)", textAlign: "center", maxWidth: 520, lineHeight: 1.55 }}>
          arXiv・Google Scholar から論文を横断検索 — ランク付け・引用数・翻訳つき。
        </p>

        <div
          style={{
            width: "100%",
            maxWidth: 620,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "6px 7px 6px 18px",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 999,
          }}
        >
          <SearchIcon size={18} className="" />
          <input
            aria-label="論文を検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="論文を検索…"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 15,
              color: "var(--text)",
              fontFamily: "inherit",
            }}
          />
          <button
            aria-label="search"
            onClick={() => submit()}
            className="icon-btn"
            style={{ width: 36, height: 36, flexShrink: 0, background: "var(--accent)", color: "#fff" }}
          >
            <SearchIcon size={17} strokeWidth={2.2} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 9, flexWrap: "wrap", justifyContent: "center", marginTop: 16, maxWidth: 620 }}>
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip" onClick={() => submit(s)}>
              {s}
            </button>
          ))}
        </div>

        <p style={{ marginTop: 30, fontSize: 12.5, color: "var(--faint)" }}>
          現在のソース: <b style={{ color: "var(--muted)" }}>{user.search_source}</b> · 設定から変更できます
        </p>
      </main>
    </div>
  );
}
