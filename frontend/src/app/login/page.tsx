"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import NavBar from "@/features/layout/NavBar";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(identifier, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ログインに失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <NavBar />
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 32px" }}>
        <div className="card" style={{ width: 380, maxWidth: "100%", borderRadius: 16, padding: 28 }}>
          <h1 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 600, color: "var(--text)" }}>ログイン</h1>
          <form onSubmit={submit}>
            <label className="label" htmlFor="login-identifier">メールまたはユーザー名</label>
            <input
              id="login-identifier"
              className="field"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@example.com"
              required
              style={{ marginBottom: 16 }}
            />
            <label className="label" htmlFor="login-password">パスワード</label>
            <input
              id="login-password"
              className="field"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{ marginBottom: error ? 12 : 20 }}
            />
            {error && (
              <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "var(--danger)" }}>{error}</p>
            )}
            <button type="submit" className="btn btn-accent" disabled={busy} style={{ width: "100%", padding: 11, marginBottom: 16 }}>
              {busy ? "…" : "ログイン"}
            </button>
          </form>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
            アカウントがない？ <Link href="/register" className="link-accent">登録</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
