"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import NavBar from "@/features/layout/NavBar";
import { ApiError, settingsApi } from "@/lib/api";

export default function SettingsPage() {
  const { user, loading, setUser } = useAuth();
  const router = useRouter();

  const [source, setSource] = useState<"arxiv" | "scholar">("arxiv");
  const [llmBaseUrl, setLlmBaseUrl] = useState("");
  const [llmModel, setLlmModel] = useState("");
  const [llmKey, setLlmKey] = useState("");
  const [serpKey, setSerpKey] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      setSource(user.search_source);
      setLlmBaseUrl(user.llm_base_url || "");
      setLlmModel(user.llm_model || "");
    }
  }, [user]);

  if (loading || !user) return null;

  const save = async () => {
    setBusy(true);
    setMsg(null);
    setError(null);
    const body: Record<string, unknown> = {
      search_source: source,
      llm_base_url: llmBaseUrl,
      llm_model: llmModel,
    };
    if (llmKey) body.llm_api_key = llmKey;
    if (serpKey) body.serpapi_key = serpKey;
    try {
      const updated = await settingsApi.update(body);
      setUser(updated);
      setLlmKey("");
      setSerpKey("");
      setMsg("設定を保存しました。");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <NavBar />
      <main style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 32px 64px" }}>
          <h1 style={{ margin: "0 0 22px", fontSize: 26, fontWeight: 600, letterSpacing: "-.02em", color: "var(--text)" }}>設定</h1>

          {msg && (
            <div className="card" style={{ padding: "11px 16px", marginBottom: 16, background: "var(--accent-soft-bg)", border: "none", color: "var(--accent-soft-text)", fontSize: 13 }}>{msg}</div>
          )}
          {error && (
            <div className="card" style={{ padding: "11px 16px", marginBottom: 16, background: "var(--danger-soft-bg)", border: "none", color: "var(--danger)", fontSize: 13 }}>{error}</div>
          )}

          {/* search source */}
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <h2 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 600, color: "var(--text)" }}>検索ソース</h2>
            <Radio
              checked={source === "arxiv"}
              onSelect={() => setSource("arxiv")}
              label="arXiv（無料・キー不要）"
            />
            <Radio
              checked={source === "scholar"}
              onSelect={() => setSource("scholar")}
              label="Google Scholar（SerpApi キーが必要）"
            />
          </div>

          {/* LLM translation */}
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text)" }}>LLM 翻訳（OpenAI 互換）</h2>
              {user.has_llm_key && <Badge>キー設定済</Badge>}
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.55 }}>
              OpenAI・LM Studio・Ollama・vLLM などに対応。ベース URL を入力してください。
            </p>
            <Field label="ベース URL" value={llmBaseUrl} onChange={setLlmBaseUrl} placeholder="https://api.openai.com/v1" />
            <Field label="モデル" value={llmModel} onChange={setLlmModel} placeholder="gpt-4o-mini" />
            <Field
              label={`API キー${user.has_llm_key ? "（空欄で現状維持）" : ""}`}
              value={llmKey}
              onChange={setLlmKey}
              placeholder="sk-··· （暗号化して保存）"
              type="password"
              last
            />
          </div>

          {/* SerpApi key */}
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text)" }}>SerpApi キー（Google Scholar）</h2>
              {user.has_serpapi_key && <Badge>キー設定済</Badge>}
            </div>
            <Field
              label={`API キー${user.has_serpapi_key ? "（空欄で現状維持）" : ""}`}
              value={serpKey}
              onChange={setSerpKey}
              placeholder="暗号化して保存"
              type="password"
              last
            />
          </div>

          <button className="btn btn-accent" onClick={save} disabled={busy}>
            {busy ? "保存中…" : "設定を保存"}
          </button>
        </div>
      </main>
    </div>
  );
}

function Radio({ checked, onSelect, label }: { checked: boolean; onSelect: () => void; label: string }) {
  return (
    <label
      onClick={onSelect}
      className="settings-radio"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: "10px 12px",
        borderRadius: 10,
        cursor: "pointer",
        ...(checked ? { background: "var(--accent-soft-bg)" } : {}),
        marginBottom: 6,
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: `2px solid ${checked ? "var(--accent)" : "var(--faint)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {checked && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} />}
      </span>
      <span style={{ fontSize: 14, color: checked ? "var(--text)" : "var(--muted)" }}>{label}</span>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  last,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  last?: boolean;
}) {
  const id = useId();
  return (
    <div style={{ marginBottom: last ? 0 : 14 }}>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className="field" type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 999, background: "var(--accent-soft-bg)", color: "var(--accent-soft-text)" }}>
      {children}
    </span>
  );
}
