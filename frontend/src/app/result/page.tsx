"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import NavBar from "@/features/layout/NavBar";
import { SearchIcon } from "@/features/ui/icons";
import { ApiError, Paper, searchApi, translateApi } from "@/lib/api";

type SortKey = "relevant_no" | "date" | "cite_num" | "tier";
type SourceFilter = "all" | "arxiv" | "scholar";
type Period = "all" | "2025" | "2023" | "2021";

const SOURCE_META: Record<string, { label: string; dot: string }> = {
  arxiv: { label: "arXiv", dot: "#c2683f" },
  scholar: { label: "Google Scholar", dot: "#4f9d78" },
  ieee: { label: "IEEE", dot: "#5b8def" },
  acm: { label: "ACM", dot: "#9a9a9a" },
  sciencedirect: { label: "ScienceDirect", dot: "#e0912f" },
};
const sourceMeta = (s: string) => SOURCE_META[s] || { label: s, dot: "var(--faint)" };

function paperYear(date?: string | null): number | null {
  if (!date || date.length < 2) return null;
  const yy = parseInt(date.slice(0, 2), 10);
  if (isNaN(yy)) return null;
  // century cutoff: '91 -> 1991 (arXiv started 1991), '24 -> 2024
  return yy >= 50 ? 1900 + yy : 2000 + yy;
}

const SORTS: { key: SortKey; label: string }[] = [
  { key: "relevant_no", label: "関連度順" },
  { key: "date", label: "日付順" },
  { key: "cite_num", label: "引用数順" },
  { key: "tier", label: "会議ランク順" },
];
const PERIODS: { key: Period; label: string }[] = [
  { key: "all", label: "すべての期間" },
  { key: "2025", label: "2025 年以降" },
  { key: "2023", label: "2023 年以降" },
  { key: "2021", label: "2021 年以降" },
];
const SOURCES: { key: SourceFilter; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "arxiv", label: "arXiv" },
  { key: "scholar", label: "Google Scholar" },
];

function ResultContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const query = params.get("query") || "";

  const [input, setInput] = useState(query);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  const [period, setPeriod] = useState<Period>("all");
  const [sortKey, setSortKey] = useState<SortKey>("relevant_no");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    setInput(query);
    if (!query || !user) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      setError(null);
      const t0 = typeof performance !== "undefined" ? performance.now() : 0;
      try {
        const res = await searchApi.search(query);
        if (!cancelled) {
          setPapers(res.results);
          setElapsed((performance.now() - t0) / 1000);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "検索に失敗しました");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query, user]);

  const visible = useMemo(() => {
    let list = papers.slice();
    if (sourceFilter !== "all") list = list.filter((p) => p.source === sourceFilter);
    if (period !== "all") {
      const min = parseInt(period, 10);
      list = list.filter((p) => {
        const y = paperYear(p.date);
        return y != null && y >= min;
      });
    }
    const cmp: Record<SortKey, (a: Paper, b: Paper) => number> = {
      relevant_no: (a, b) => a.relevant_no - b.relevant_no,
      date: (a, b) => (b.date || "").localeCompare(a.date || ""),
      cite_num: (a, b) => (b.cite_num ?? -1) - (a.cite_num ?? -1),
      tier: (a, b) => (a.tier ?? 99) - (b.tier ?? 99),
    };
    return list.sort((a, b) => cmp[sortKey](a, b) || a.relevant_no - b.relevant_no);
  }, [papers, sourceFilter, period, sortKey]);

  const runSearch = () => {
    if (input.trim()) router.push(`/result?query=${encodeURIComponent(input.trim())}`);
  };

  if (loading || !user) return null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <NavBar />
      <main style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 32px 64px" }}>
          {/* search field */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              padding: "5px 6px 5px 16px",
              border: "1px solid var(--border)",
              borderRadius: 999,
              maxWidth: 560,
              marginBottom: 8,
            }}
          >
            <SearchIcon size={17} />
            <input
              aria-label="論文を検索"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="論文を検索…"
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "var(--text)", fontFamily: "inherit" }}
            />
            <button aria-label="search" onClick={runSearch} className="icon-btn" style={{ width: 32, height: 32, background: "var(--accent)", color: "#fff" }}>
              <SearchIcon size={16} strokeWidth={2.2} />
            </button>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--faint)", marginBottom: 22 }}>
            {busy
              ? "検索中…"
              : error
              ? " "
              : `約 ${visible.length} 件${elapsed != null ? `（${elapsed.toFixed(2)} 秒）` : ""}`}
          </div>

          {error && (
            <div
              className="card"
              style={{ padding: "12px 16px", marginBottom: 20, color: "var(--danger)", background: "var(--danger-soft-bg)", fontSize: 13.5 }}
            >
              {error}
            </div>
          )}

          {/* body: filter rail + list */}
          <div className="results-grid">
            <aside className="results-rail">
              <FilterGroup title="期間">
                {PERIODS.map((o) => (
                  <button key={o.key} className={`filter-opt ${period === o.key ? "active" : ""}`} onClick={() => setPeriod(o.key)}>
                    {o.label}
                  </button>
                ))}
              </FilterGroup>
              <FilterGroup title="並べ替え">
                {SORTS.map((o) => (
                  <button key={o.key} className={`filter-opt ${sortKey === o.key ? "active" : ""}`} onClick={() => setSortKey(o.key)}>
                    {o.label}
                  </button>
                ))}
              </FilterGroup>
              <FilterGroup title="ソース">
                {SOURCES.map((o) => (
                  <button key={o.key} className={`filter-opt ${sourceFilter === o.key ? "active" : ""}`} onClick={() => setSourceFilter(o.key)}>
                    {o.label}
                  </button>
                ))}
              </FilterGroup>
            </aside>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {busy && <div style={{ display: "flex", gap: 10, alignItems: "center", color: "var(--muted)", fontSize: 13.5 }}><span className="spinner" /> 検索中…</div>}
              {!busy && visible.map((p, i) => (
                <PaperItem key={`${p.url}-${i}`} p={p} canTranslate={user.has_llm_key} />
              ))}
              {!busy && !error && visible.length === 0 && query && (
                <div style={{ color: "var(--muted)", fontSize: 13.5 }}>該当する論文がありません。</div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="filter-head">{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

function PaperItem({ p, canTranslate }: { p: Paper; canTranslate: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);
  const [tBusy, setTBusy] = useState(false);
  const [tErr, setTErr] = useState<string | null>(null);

  const meta = sourceMeta(p.source);
  const abstract = p.abstract || "";
  const MAX = 260;
  const year = paperYear(p.date);

  const translate = async () => {
    setTBusy(true);
    setTErr(null);
    try {
      const res = await translateApi.translate(`${p.title}\n\n${abstract}`);
      setTranslated(res.translated);
    } catch (err) {
      setTErr(err instanceof ApiError ? err.message : "翻訳に失敗しました");
    } finally {
      setTBusy(false);
    }
  };

  return (
    <div style={{ padding: "18px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11.5,
            padding: "3px 10px",
            borderRadius: 999,
            background: "var(--hover)",
            color: "var(--muted)",
            border: "1px solid var(--border)",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.dot }} />
          {meta.label}
        </span>
        {p.tier < 99 && (
          <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 999, background: "var(--accent-soft-bg)", color: "var(--accent-soft-text)", fontWeight: 500 }}>
            tier {p.tier}
          </span>
        )}
      </div>

      <a
        href={p.url}
        target="_blank"
        rel="noopener noreferrer"
        className="paper-title"
        style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-.01em", lineHeight: 1.35, display: "block" }}
      >
        {p.title}
      </a>

      {(p.author || p.conference || year) && (
        <div style={{ fontSize: 13, color: "var(--accent-soft-text)", marginTop: 5, opacity: 0.85 }}>
          {[p.author, p.conference, year].filter(Boolean).join(" · ")}
        </div>
      )}

      {abstract && (
        <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6, margin: "8px 0 0" }}>
          {expanded ? abstract : abstract.slice(0, MAX)}
          {abstract.length > MAX && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              style={{ color: "var(--accent-soft-text)", cursor: "pointer", background: "none", border: "none", padding: 0, font: "inherit" }}
            >
              {expanded ? " 閉じる" : "… 続き"}
            </button>
          )}
        </p>
      )}

      {translated && (
        <div className="card" style={{ marginTop: 10, padding: "10px 13px", background: "var(--accent-soft-bg)", border: "none", fontSize: 13.5, color: "var(--text)", lineHeight: 1.6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {translated}
        </div>
      )}
      {tErr && <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 6 }}>{tErr}</div>}

      <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 11, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, color: "var(--faint)" }}>引用 {p.cite_num ?? "—"}</span>
        <span style={{ fontSize: 12.5, color: "var(--faint)" }}>{p.pages ?? "—"} ページ</span>
        <a
          href={`https://scholar.google.com/scholar?q=${encodeURIComponent(p.title)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none" }}
        >
          関連記事
        </a>
        <button
          type="button"
          onClick={translate}
          disabled={!canTranslate || tBusy}
          aria-label="日本語に翻訳"
          title={canTranslate ? "日本語に翻訳" : "設定でLLMキーを登録してください"}
          style={{
            fontSize: 12.5,
            color: canTranslate ? "var(--accent-soft-text)" : "var(--faint)",
            cursor: canTranslate && !tBusy ? "pointer" : "default",
            fontWeight: 500,
            background: "none",
            border: "none",
            padding: 0,
            fontFamily: "inherit",
          }}
        >
          {tBusy ? "翻訳中…" : "翻訳"}
        </button>
      </div>
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={null}>
      <ResultContent />
    </Suspense>
  );
}
