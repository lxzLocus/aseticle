"use client";

import { Box, Button, Card, Flex, Heading, Text, TextField } from "@radix-ui/themes";
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
      setError("Username must be at least 3 characters");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setBusy(true);
    try {
      await register(email, username, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <NavBar />
      <Flex justify="center" mt="9" px="4">
        <Card style={{ width: 380 }}>
          <form onSubmit={submit}>
            <Flex direction="column" gap="3" p="3">
              <Heading size="5">Create account</Heading>
              <Box>
                <Text size="2" weight="bold">Email</Text>
                <TextField.Root
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </Box>
              <Box>
                <Text size="2" weight="bold">Username</Text>
                <TextField.Root
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </Box>
              <Box>
                <Text size="2" weight="bold">Password (min 8 chars)</Text>
                <TextField.Root
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Box>
              {error && <Text color="red" size="2">{error}</Text>}
              <Button type="submit" disabled={busy}>
                {busy ? "..." : "Register"}
              </Button>
              <Text size="2">
                Have an account? <Link href="/login">Login</Link>
              </Text>
            </Flex>
          </form>
        </Card>
      </Flex>
    </>
  );
}
