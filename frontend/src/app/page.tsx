"use client";

import { Box, Flex, Heading, IconButton, Text, TextField } from "@radix-ui/themes";
import { ArrowRightIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import NavBar from "@/features/layout/NavBar";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  const submit = () => {
    if (query.trim()) router.push(`/result?query=${encodeURIComponent(query.trim())}`);
  };

  if (loading || !user) return null;

  return (
    <>
      <NavBar />
      <Flex direction="column" align="center" justify="center" gap="5" style={{ marginTop: "18vh" }} px="4">
        <Heading size="9">ASEticle</Heading>
        <Text color="gray">Search papers from arXiv & Google Scholar — ranked, cited, translatable.</Text>
        <Box style={{ width: 560, maxWidth: "100%" }}>
          <TextField.Root
            size="3"
            placeholder="Search the scholar…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          >
            <TextField.Slot>
              <MagnifyingGlassIcon height="18" width="18" />
            </TextField.Slot>
            <TextField.Slot pr="3">
              <IconButton size="2" variant="ghost" onClick={submit}>
                <ArrowRightIcon height="18" width="18" />
              </IconButton>
            </TextField.Slot>
          </TextField.Root>
        </Box>
        <Text size="2" color="gray">
          Current source: <b>{user.search_source}</b> · change it in Settings
        </Text>
      </Flex>
    </>
  );
}
