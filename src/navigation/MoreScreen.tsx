/** Phone "More" tab — every section, quick actions, theme and sign-out. */
import React from "react";
import { ChevronRight, LogOut, Moon, Sun } from "lucide-react-native";
import { Card, Col, Divider, Row, Screen, Text, Button } from "@shared/ui";
import { useTheme } from "@shared/useTheme";
import { useAuthStore } from "@shared/store/useAuthStore";
import { useThemeStore } from "@shared/store/useThemeStore";
import { can } from "@shared/lib/permissions";
import { NAV_ITEMS, QUICK_ACTIONS } from "./navItems";
import { useAppNav } from "./useAppNav";

export function MoreScreen() {
  const t = useTheme();
  const nav = useAppNav();
  const user = useAuthStore((s) => s.user);
  const org = useAuthStore((s) => s.organization);
  const logout = useAuthStore((s) => s.logout);
  const { preference, setPreference } = useThemeStore();
  const dark = preference === "dark" || (preference === "system" && t.isDark);
  const role = user?.role;

  return (
    <Screen title="More" subtitle={org?.name}>
      <Col gap={16}>
        <Card padding={0}>
          {NAV_ITEMS.filter((n) => !n.perm || can(role, n.perm)).map((n, i) => {
            const Icon = n.icon;
            return (
              <React.Fragment key={n.route}>
                {i > 0 ? <Divider /> : null}
                <Card
                  padding={14}
                  onPress={() => nav.navigate(n.route)}
                  style={{ borderWidth: 0 }}
                  testID={`more-${n.route}`}
                >
                  <Row gap={12}>
                    <Icon size={18} color={t.c.accent} />
                    <Text style={{ flex: 1 }}>{n.label}</Text>
                    <ChevronRight size={16} color={t.c.textFaint} />
                  </Row>
                </Card>
              </React.Fragment>
            );
          })}
        </Card>
        <Text variant="overline" tone="muted">
          Quick actions
        </Text>
        <Row wrap gap={8}>
          {QUICK_ACTIONS.filter((a) => !a.perm || can(role, a.perm)).map(
            (a) => (
              <Button
                key={a.route}
                title={a.label}
                variant="secondary"
                size="sm"
                onPress={() => nav.navigate(a.route)}
              />
            ),
          )}
        </Row>
        <Card>
          <Row justify="space-between">
            <Col gap={2}>
              <Text variant="bodyStrong">{user?.name}</Text>
              <Text variant="caption" tone="faint">
                {user?.email} · {user?.role}
              </Text>
            </Col>
            <Button
              title={dark ? "Light" : "Dark"}
              icon={dark ? Sun : Moon}
              variant="ghost"
              size="sm"
              onPress={() => setPreference(dark ? "light" : "dark")}
            />
          </Row>
        </Card>
        <Button
          title="Log out"
          icon={LogOut}
          variant="secondary"
          onPress={() => logout()}
          testID="more-logout"
        />
      </Col>
    </Screen>
  );
}
