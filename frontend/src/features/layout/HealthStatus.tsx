"use client";

import { Flex, HoverCard, Text } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { healthApi, HealthStatus as Health } from "@/lib/api";

const POLL_MS = 20000;

type Dot = "green" | "red" | "gray";

function Circle({ color }: { color: Dot }) {
  const bg = color === "green" ? "#30a46c" : color === "red" ? "#e5484d" : "#8b8d98";
  return (
    <span
      style={{
        display: "inline-block",
        width: 9,
        height: 9,
        borderRadius: "50%",
        background: bg,
        boxShadow: color === "green" ? "0 0 5px #30a46c" : "none",
      }}
    />
  );
}

export default function HealthStatus() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const h = await healthApi.status();
        if (alive) {
          setHealth(h);
          setError(false);
        }
      } catch {
        if (alive) setError(true);
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const egress = health?.egress;
  const overall: Dot = error
    ? "red"
    : !health
    ? "gray"
    : health.online
    ? "green"
    : "red";
  const egressDot: Dot =
    egress == null ? "gray" : egress.online ? "green" : "red";

  const label = error
    ? "offline"
    : egress
    ? `${egress.mode}`
    : "…";

  return (
    <HoverCard.Root openDelay={100}>
      <HoverCard.Trigger>
        <Flex align="center" gap="2" style={{ cursor: "default" }}>
          <Circle color={overall} />
          <Text size="1" color="gray">
            {label}
          </Text>
        </Flex>
      </HoverCard.Trigger>
      <HoverCard.Content size="1" style={{ maxWidth: 260 }}>
        <Flex direction="column" gap="2">
          <Text size="2" weight="bold">
            System status
          </Text>
          {error ? (
            <Text size="1" color="red">
              Backend unreachable
            </Text>
          ) : !health ? (
            <Text size="1" color="gray">
              Checking…
            </Text>
          ) : (
            <>
              <Row ok={health.backend} label="Backend API" />
              <Row ok={health.db} label="Database" />
              <Row
                ok={!!egress?.online}
                label={`Egress (${egress?.mode})`}
                detail={egress?.detail}
              />
              {egress?.mode === "relay" && (
                <Text size="1" color="gray">
                  agent: {egress?.agent_online ? "online" : "offline"}
                  {egress?.pending_jobs != null && ` · queue ${egress.pending_jobs}`}
                </Text>
              )}
            </>
          )}
        </Flex>
      </HoverCard.Content>
    </HoverCard.Root>
  );
}

function Row({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <Flex align="center" gap="2">
      <Circle color={ok ? "green" : "red"} />
      <Text size="1">{label}</Text>
      {detail && (
        <Text size="1" color="gray">
          — {detail}
        </Text>
      )}
    </Flex>
  );
}
