"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import NavBar from "@/features/layout/NavBar";
import { ApiError } from "@/lib/api";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (username.trim().length < 3) {
      setError("ユーザー名は3文字以上にしてください");
      return;
    }
    if (password.length < 8) {
      setError("パスワードは8文字以上にしてください");
      return;
    }
    setBusy(true);
    try {
      await register(email, username, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "登録に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <NavBar />
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 32px" }}>
        <div className="card" style={{ width: 380, maxWidth: "100%", borderRadius: 16, padding: 28 }}>
          <h1 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 600, color: "var(--text)" }}>アカウント作成</h1>
          <form onSubmit={submit}>
            <label className="label" htmlFor="reg-email">メール</label>
            <input
              id="reg-email"
              className="field"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{ marginBottom: 14 }}
            />
            <label className="label" htmlFor="reg-username">ユーザー名</label>
            <input
              id="reg-username"
              className="field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="yu"
              required
              style={{ marginBottom: 14 }}
            />
            <label className="label" htmlFor="reg-password">パスワード（8文字以上）</label>
            <input
              id="reg-password"
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
              {busy ? "…" : "登録"}
            </button>
          </form>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
            アカウントがある？ <Link href="/login" className="link-accent">ログイン</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
