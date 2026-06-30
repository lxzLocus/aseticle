"use client";

import { Button, Flex, Switch, Text } from "@radix-ui/themes";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/AuthContext";
import { useThemeMode } from "@/app/providers";

export default function NavBar() {
  const { user, logout } = useAuth();
  const { darkMode, toggle } = useThemeMode();
  const router = useRouter();

  return (
    <Flex
      align="center"
      justify="between"
      px="4"
      py="2"
      style={{
        borderBottom: "1px solid var(--gray-5)",
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "var(--color-background)",
      }}
    >
      <Text size="5" weight="bold" style={{ cursor: "pointer" }} onClick={() => router.push("/")}>
        ASEticle
      </Text>

      <Flex align="center" gap="4">
        <Flex align="center" gap="2">
          <Text size="2">Dark</Text>
          <Switch checked={darkMode} onCheckedChange={toggle} />
        </Flex>

        {user ? (
          <>
            <Text size="2">{user.username}</Text>
            <Button variant="soft" size="2" onClick={() => router.push("/settings")}>
              Settings
            </Button>
            <Button
              variant="soft"
              color="gray"
              size="2"
              onClick={async () => {
                await logout();
                router.push("/login");
              }}
            >
              Logout
            </Button>
          </>
        ) : (
          <>
            <Button variant="soft" size="2" onClick={() => router.push("/login")}>
              Login
            </Button>
            <Button size="2" onClick={() => router.push("/register")}>
              Register
            </Button>
          </>
        )}
      </Flex>
    </Flex>
  );
}
