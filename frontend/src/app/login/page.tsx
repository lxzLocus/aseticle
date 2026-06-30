"use client";

import { Box, Button, Card, Flex, Heading, Text, TextField } from "@radix-ui/themes";
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
      setError(err instanceof ApiError ? err.message : "Login failed");
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
              <Heading size="5">Login</Heading>
              <Box>
                <Text size="2" weight="bold">Email or Username</Text>
                <TextField.Root
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </Box>
              <Box>
                <Text size="2" weight="bold">Password</Text>
                <TextField.Root
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Box>
              {error && <Text color="red" size="2">{error}</Text>}
              <Button type="submit" disabled={busy}>
                {busy ? "..." : "Login"}
              </Button>
              <Text size="2">
                No account? <Link href="/register">Register</Link>
              </Text>
            </Flex>
          </form>
        </Card>
      </Flex>
    </>
  );
}
