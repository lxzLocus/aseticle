"use client";

import {
  Badge,
  Box,
  Button,
  Callout,
  Card,
  Flex,
  Heading,
  IconButton,
  Select,
  Spinner,
  Text,
  TextField,
} from "@radix-ui/themes";
import { ArrowRightIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import NavBar from "@/features/layout/NavBar";
import { ApiError, Paper, searchApi, translateApi } from "@/lib/api";

type SortKey = "relevant_no" | "date" | "tier" | "cite_num";

const SOURCE_COLORS: Record<string, "tomato" | "indigo" | "orange" | "gray" | "green"> = {
  arxiv: "tomato",
  ieee: "indigo",
  sciencedirect: "orange",
  acm: "gray",
  scholar: "green",
};

function ResultContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const query = params.get("query") || "";

  const [input, setInput] = useState(query);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("relevant_no");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

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
      try {
        const res = await searchApi.search(query);
        if (!cancelled) setPapers(res.results);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Search failed");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query, user]);

  const sources = useMemo(
    () => Array.from(new Set(papers.map((p) => p.source))),
    [papers]
  );

  const visible = useMemo(() => {
    let list = papers;
    if (sourceFilter !== "all") list = list.filter((p) => p.source === sourceFilter);
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = (a[sortKey] ?? (sortKey === "tier" ? 99 : 0)) as number | string;
      const bv = (b[sortKey] ?? (sortKey === "tier" ? 99 : 0)) as number | string;
      if (typeof av === "string" || typeof bv === "string") {
        return String(av).localeCompare(String(bv)) * dir || a.relevant_no - b.relevant_no;
      }
      return ((av as number) - (bv as number)) * dir || a.relevant_no - b.relevant_no;
    });
  }, [papers, sourceFilter, sortKey, sortDir]);

  const runSearch = () => {
    if (input.trim()) router.push(`/result?query=${encodeURIComponent(input.trim())}`);
  };

  if (loading || !user) return null;

  return (
    <>
      <NavBar />
      <Box px="4" py="3" style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Flex gap="3" align="center" mb="4">
          <Box style={{ flex: 1, maxWidth: 480 }}>
            <TextField.Root
              size="3"
              value={input}
              placeholder="Search the scholar…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
            >
              <TextField.Slot><MagnifyingGlassIcon /></TextField.Slot>
              <TextField.Slot pr="3">
                <IconButton size="2" variant="ghost" onClick={runSearch}>
                  <ArrowRightIcon />
                </IconButton>
              </TextField.Slot>
            </TextField.Root>
          </Box>
        </Flex>

        <Flex gap="4" wrap="wrap" align="center" mb="4">
          <Flex align="center" gap="2">
            <Text size="2">Source</Text>
            <Select.Root value={sourceFilter} onValueChange={setSourceFilter}>
              <Select.Trigger />
              <Select.Content>
                <Select.Item value="all">All</Select.Item>
                {sources.map((s) => (
                  <Select.Item key={s} value={s}>{s}</Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Flex>
          <Flex align="center" gap="2">
            <Text size="2">Sort by</Text>
            <Select.Root value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <Select.Trigger />
              <Select.Content>
                <Select.Item value="relevant_no">Relevance</Select.Item>
                <Select.Item value="date">Date</Select.Item>
                <Select.Item value="tier">Conference rank</Select.Item>
                <Select.Item value="cite_num">Citations</Select.Item>
              </Select.Content>
            </Select.Root>
            <Select.Root value={sortDir} onValueChange={(v) => setSortDir(v as "asc" | "desc")}>
              <Select.Trigger />
              <Select.Content>
                <Select.Item value="asc">Ascending</Select.Item>
                <Select.Item value="desc">Descending</Select.Item>
              </Select.Content>
            </Select.Root>
          </Flex>
          <Text size="2" color="gray">{visible.length} results</Text>
        </Flex>

        {error && (
          <Callout.Root color="red" mb="3"><Callout.Text>{error}</Callout.Text></Callout.Root>
        )}
        {busy && (
          <Flex align="center" gap="2" my="5"><Spinner /> <Text>Searching…</Text></Flex>
        )}

        <Flex direction="column" gap="3">
          {visible.map((p, i) => (
            <PaperCard key={`${p.url}-${i}`} paper={p} canTranslate={user.has_llm_key} />
          ))}
          {!busy && !error && visible.length === 0 && query && (
            <Text color="gray">No results.</Text>
          )}
        </Flex>
      </Box>
    </>
  );
}

function PaperCard({ paper, canTranslate }: { paper: Paper; canTranslate: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);
  const [tBusy, setTBusy] = useState(false);
  const [tErr, setTErr] = useState<string | null>(null);

  const MAX = 300;
  const abstract = paper.abstract || "";
  const color = SOURCE_COLORS[paper.source] || "gray";

  const translate = async () => {
    setTBusy(true);
    setTErr(null);
    try {
      const text = `${paper.title}\n\n${abstract}`;
      const res = await translateApi.translate(text);
      setTranslated(res.translated);
    } catch (err) {
      setTErr(err instanceof ApiError ? err.message : "Translation failed");
    } finally {
      setTBusy(false);
    }
  };

  return (
    <Card>
      <Flex justify="between" gap="3">
        <Box style={{ flex: 1 }}>
          <a href={paper.url} target="_blank" rel="noopener noreferrer">
            <Heading size="3">{paper.title}</Heading>
          </a>
          {paper.author && <Text as="p" size="2" color="gray">{paper.author}</Text>}
          {abstract && (
            <Text as="p" size="2" mt="2">
              {expanded ? abstract : abstract.slice(0, MAX)}
              {abstract.length > MAX && (
                <Text
                  as="span"
                  color="mint"
                  style={{ cursor: "pointer" }}
                  onClick={() => setExpanded((e) => !e)}
                >
                  {expanded ? " Read less" : "… Read more"}
                </Text>
              )}
            </Text>
          )}

          {translated && (
            <Callout.Root mt="2" color="mint">
              <Callout.Text style={{ whiteSpace: "pre-wrap" }}>{translated}</Callout.Text>
            </Callout.Root>
          )}
          {tErr && <Text as="p" size="1" color="red" mt="1">{tErr}</Text>}

          <Flex gap="3" mt="2" align="center" wrap="wrap">
            <Text size="1" color="gray">{paper.date || "—"}</Text>
            <Text size="1" color="gray">· {paper.pages ?? "?"} pages</Text>
            <Text size="1" color="gray">· Cited: {paper.cite_num ?? "—"}</Text>
            {paper.conference && <Text size="1" color="gray">· {paper.conference}</Text>}
            {paper.tier < 99 && <Badge color="amber">tier {paper.tier}</Badge>}
            <Button
              size="1"
              variant="soft"
              disabled={tBusy || !canTranslate}
              title={canTranslate ? "Translate to Japanese" : "Set an LLM key in Settings"}
              onClick={translate}
            >
              {tBusy ? "翻訳中…" : "翻訳"}
            </Button>
          </Flex>
        </Box>
        <Box>
          <Badge size="2" variant="outline" color={color}>{paper.source}</Badge>
        </Box>
      </Flex>
    </Card>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={null}>
      <ResultContent />
    </Suspense>
  );
}
