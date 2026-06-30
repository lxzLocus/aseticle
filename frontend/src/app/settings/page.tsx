"use client";

import {
  Badge,
  Box,
  Button,
  Callout,
  Card,
  Flex,
  Heading,
  RadioGroup,
  Text,
  TextField,
} from "@radix-ui/themes";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
      setMsg("Settings saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <NavBar />
      <Flex justify="center" mt="6" px="4" pb="9">
        <Box style={{ width: 560, maxWidth: "100%" }}>
          <Heading size="6" mb="4">Settings</Heading>

          {msg && (
            <Callout.Root color="green" mb="3"><Callout.Text>{msg}</Callout.Text></Callout.Root>
          )}
          {error && (
            <Callout.Root color="red" mb="3"><Callout.Text>{error}</Callout.Text></Callout.Root>
          )}

          <Card mb="4">
            <Flex direction="column" gap="3" p="2">
              <Heading size="4">Search source</Heading>
              <RadioGroup.Root value={source} onValueChange={(v) => setSource(v as any)}>
                <RadioGroup.Item value="arxiv">arXiv (free, no key required)</RadioGroup.Item>
                <RadioGroup.Item value="scholar">Google Scholar (requires SerpApi key)</RadioGroup.Item>
              </RadioGroup.Root>
            </Flex>
          </Card>

          <Card mb="4">
            <Flex direction="column" gap="3" p="2">
              <Flex align="center" gap="2">
                <Heading size="4">LLM translation (OpenAI-compatible)</Heading>
                {user.has_llm_key && <Badge color="green">key set</Badge>}
              </Flex>
              <Text size="2" color="gray">
                Works with OpenAI, LM Studio, Ollama, vLLM, etc. Enter the base URL
                (e.g. http://localhost:1234/v1 or https://api.openai.com/v1).
              </Text>
              <Box>
                <Text size="2" weight="bold">Base URL</Text>
                <TextField.Root
                  value={llmBaseUrl}
                  onChange={(e) => setLlmBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                />
              </Box>
              <Box>
                <Text size="2" weight="bold">Model</Text>
                <TextField.Root
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  placeholder="gpt-4o-mini / local-model-name"
                />
              </Box>
              <Box>
                <Text size="2" weight="bold">API key {user.has_llm_key && "(leave blank to keep)"}</Text>
                <TextField.Root
                  type="password"
                  value={llmKey}
                  onChange={(e) => setLlmKey(e.target.value)}
                  placeholder="sk-... (stored encrypted)"
                />
              </Box>
            </Flex>
          </Card>

          <Card mb="4">
            <Flex direction="column" gap="3" p="2">
              <Flex align="center" gap="2">
                <Heading size="4">SerpApi key (Google Scholar)</Heading>
                {user.has_serpapi_key && <Badge color="green">key set</Badge>}
              </Flex>
              <Box>
                <Text size="2" weight="bold">API key {user.has_serpapi_key && "(leave blank to keep)"}</Text>
                <TextField.Root
                  type="password"
                  value={serpKey}
                  onChange={(e) => setSerpKey(e.target.value)}
                  placeholder="stored encrypted"
                />
              </Box>
            </Flex>
          </Card>

          <Button size="3" onClick={save} disabled={busy}>
            {busy ? "Saving..." : "Save settings"}
          </Button>
        </Box>
      </Flex>
    </>
  );
}
