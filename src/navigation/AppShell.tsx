/**
 * Tenant app chrome.
 *   desktop/tablet: sidebar + top bar (branch switcher, ⌘K, theme, user)
 *   phone:          compact top bar + bottom tabs
 * Also: loads /auth/me + business profile (brand colour → app accent) and
 * shows the subscription banner (trial ending / grace / read-only).
 */
import React, { useEffect } from "react";
import { Image, Platform, Pressable, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu, Moon, Search, Sun } from "lucide-react-native";
import { useLayout, useTheme } from "@shared/useTheme";
import { Banner, Col, IconButton, Row, Select, Text } from "@shared/ui";
import { useAuthStore } from "@shared/store/useAuthStore";
import { useBranchStore } from "@shared/store/useBranchStore";
import { useThemeStore } from "@shared/store/useThemeStore";
import { useBranches, useBusinessProfile, useMe } from "@shared/api/lookups";
import { can } from "@shared/lib/permissions";
import { NAV_ITEMS, TAB_ROUTES } from "./navItems";
import { CommandPalette, useCommandPalette } from "./CommandPalette";
import { navigationRef } from "./navigationRef";

const ROUTE_TO_SECTION: Record<string, string> = {
  BookingNew: "Bookings",
  BookingDetail: "Bookings",
  BookingEdit: "Bookings",
  DailySummary: "Bookings",
  LoadingList: "Bookings",
  BiltiNew: "Bilti",
  BiltiDetail: "Bilti",
  BiltiEdit: "Bilti",
  PartyNew: "Parties",
  PartyDetail: "Parties",
  PartyEdit: "Parties",
  PaymentNew: "Payments",
  PaymentDetail: "Payments",
  InvoiceNew: "Invoices",
  InvoiceDetail: "Invoices",
  ReportDaily: "Reports",
  ReportOutstanding: "Reports",
  ReportStation: "Reports",
  ReportGst: "Reports",
  SettingsBusiness: "Settings",
  SettingsBranding: "Settings",
  Team: "Settings",
  Stations: "Settings",
  Rates: "Settings",
  Plan: "Settings",
};

function navigate(route: string) {
  if (navigationRef.isReady())
    (navigationRef as unknown as { navigate: (r: string) => void }).navigate(
      route,
    );
}

function useSessionSync() {
  const me = useMe();
  const profile = useBusinessProfile();
  const setMe = useAuthStore((s) => s.setMe);
  const setBrandColor = useThemeStore((s) => s.setBrandColor);
  useEffect(() => {
    if (me.data)
      setMe({
        user: me.data,
        organization: me.data.organization,
        subscription: me.data.subscription,
      });
  }, [me.data, setMe]);
  useEffect(() => {
    if (profile.data?.brandColor) setBrandColor(profile.data.brandColor);
  }, [profile.data?.brandColor, setBrandColor]);
  return profile.data;
}

function BranchSwitcher({ compact }: { compact?: boolean }) {
  const { data: branches } = useBranches();
  const role = useAuthStore((s) => s.user?.role);
  const { branchId, setBranchId } = useBranchStore();
  const qc = useQueryClient();
  if (!branches || branches.length < 2) return null;
  const options = [
    ...(role !== "staff" || branches.length > 1
      ? [{ value: "all", label: "All branches" }]
      : []),
    ...branches.map((b) => ({
      value: b.id,
      label: `${b.name}${b.isHeadOffice ? " (HO)" : ""}`,
      hint: b.code,
    })),
  ];
  return (
    <View style={{ minWidth: compact ? 150 : 210 }}>
      <Select
        testID="branch-switcher"
        value={branchId}
        options={options}
        onChange={(v) => {
          setBranchId((v as string) || "all");
          qc.invalidateQueries();
        }}
      />
    </View>
  );
}

function SubscriptionBanner() {
  const sub = useAuthStore((s) => s.subscription);
  const live = useAuthStore((s) => s.liveSubscriptionState);
  const state = live || sub?.state;
  const action = (
    <Pressable onPress={() => navigate("Plan")} testID="banner-plan-link">
      <Text variant="label" tone="accent">
        View plan
      </Text>
    </Pressable>
  );
  if (state === "expired") {
    return (
      <Banner
        testID="banner-readonly"
        tone="danger"
        title="Your subscription has ended — the app is read-only"
        message="All your data is safe. You can view and export it. Renew to add or edit bookings."
        action={action}
      />
    );
  }
  if (state === "grace") {
    return (
      <Banner
        testID="banner-grace"
        tone="warning"
        title="Your plan period is over — grace period active"
        message="Everything still works for a few days. Renew to avoid read-only mode."
        action={action}
      />
    );
  }
  if (sub?.status === "trial" && sub.daysLeft != null && sub.daysLeft <= 5) {
    return (
      <Banner
        testID="banner-trial"
        tone="info"
        title={`Free trial: ${Math.max(sub.daysLeft, 0)} day${sub.daysLeft === 1 ? "" : "s"} left`}
        action={action}
      />
    );
  }
  return null;
}

function UserMenu() {
  const t = useTheme();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { preference, setPreference } = useThemeStore();
  const dark = preference === "dark" || (preference === "system" && t.isDark);
  return (
    <Row gap={4}>
      <IconButton
        icon={dark ? Sun : Moon}
        label="Toggle theme"
        testID="theme-toggle"
        onPress={() => setPreference(dark ? "light" : "dark")}
      />
      <Col gap={0} style={{ marginHorizontal: 6 }}>
        <Text variant="label" numberOfLines={1}>
          {user?.name}
        </Text>
        <Text variant="caption" tone="faint">
          {user?.role}
        </Text>
      </Col>
      <IconButton
        icon={LogOut}
        label="Log out"
        testID="logout"
        onPress={() => logout()}
      />
    </Row>
  );
}

function Sidebar({
  current,
  logo,
  name,
}: {
  current: string;
  logo?: string | null;
  name?: string;
}) {
  const t = useTheme();
  const role = useAuthStore((s) => s.user?.role);
  const active = ROUTE_TO_SECTION[current] || current;
  const groups = ["Operations", "Money", "Insights", "Setup"] as const;
  return (
    <View
      testID="sidebar"
      style={{
        width: 248,
        backgroundColor: t.c.surface,
        borderRightWidth: 1,
        borderRightColor: t.c.border,
        paddingVertical: 16,
      }}
    >
      <Row gap={10} style={{ paddingHorizontal: 18, marginBottom: 20 }}>
        {logo ? (
          <Image
            source={{ uri: logo }}
            style={{ width: 34, height: 34, borderRadius: 8 }}
            resizeMode="contain"
          />
        ) : (
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              backgroundColor: t.c.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text variant="h3" style={{ color: t.c.accentText }}>
              {(name || "S").charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text variant="h3" numberOfLines={2} style={{ flex: 1 }}>
          {name || "BharatRailGo"}
        </Text>
      </Row>
      {groups.map((g) => {
        const items = NAV_ITEMS.filter(
          (n) => n.group === g && (!n.perm || can(role, n.perm)),
        );
        if (!items.length) return null;
        return (
          <View key={g} style={{ marginBottom: 14 }}>
            <Text
              variant="overline"
              tone="faint"
              style={{ paddingHorizontal: 18, marginBottom: 4 }}
            >
              {g}
            </Text>
            {items.map((n) => {
              const on = n.route === active;
              const Icon = n.icon;
              return (
                <Pressable
                  key={n.route}
                  testID={`nav-${n.route}`}
                  accessibilityRole="link"
                  onPress={() => navigate(n.route)}
                  style={({ hovered }: { hovered?: boolean }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    marginHorizontal: 10,
                    paddingHorizontal: 10,
                    height: 40,
                    borderRadius: t.radius.md,
                    backgroundColor: on
                      ? t.c.accentSoft
                      : hovered
                        ? t.c.surfaceAlt
                        : "transparent",
                  })}
                >
                  <Icon size={18} color={on ? t.c.accent : t.c.textMuted} />
                  <Text variant="label" tone={on ? "accent" : "default"}>
                    {n.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

function PhoneTabBar({ current }: { current: string }) {
  const t = useTheme();
  const active = ROUTE_TO_SECTION[current] || current;
  const tabs = TAB_ROUTES.map((r) =>
    NAV_ITEMS.find((n) => n.route === r)!,
  ).filter(Boolean);
  return (
    <Row
      testID="tabbar"
      gap={0}
      style={{
        backgroundColor: t.c.surface,
        borderTopWidth: 1,
        borderTopColor: t.c.border,
        paddingBottom: Platform.OS === "ios" ? 18 : 4,
      }}
    >
      {[...tabs, { route: "More", label: "More", icon: Menu }].map((n) => {
        const on = n.route === active;
        const Icon = n.icon;
        return (
          <Pressable
            key={n.route}
            testID={`tab-${n.route}`}
            onPress={() => navigate(n.route)}
            style={{
              flex: 1,
              alignItems: "center",
              paddingTop: 8,
              paddingBottom: 4,
              gap: 2,
            }}
          >
            <Icon size={20} color={on ? t.c.accent : t.c.textFaint} />
            <Text
              variant="caption"
              tone={on ? "accent" : "faint"}
              numberOfLines={1}
            >
              {n.label.split(" ")[0]}
            </Text>
          </Pressable>
        );
      })}
    </Row>
  );
}

export function AppShell({
  current,
  children,
}: {
  current: string;
  children: React.ReactNode;
}) {
  const t = useTheme();
  const { isPhone } = useLayout();
  const profile = useSessionSync();
  const openPalette = () => useCommandPalette.getState().setOpen(true);

  const searchButton = (
    <Pressable
      testID="open-command-palette"
      onPress={openPalette}
      style={({ hovered }: { hovered?: boolean }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        height: 40,
        paddingHorizontal: 12,
        borderRadius: t.radius.md,
        borderWidth: 1,
        borderColor: hovered ? t.c.borderStrong : t.c.border,
        backgroundColor: t.c.surfaceSunken,
        minWidth: isPhone ? 40 : 260,
      })}
    >
      <Search size={16} color={t.c.textFaint} />
      {!isPhone ? (
        <>
          <Text tone="faint" style={{ flex: 1 }}>
            Search or jump to…
          </Text>
          <Text
            variant="caption"
            tone="faint"
            style={{ fontFamily: t.fonts.mono }}
          >
            Ctrl K
          </Text>
        </>
      ) : null}
    </Pressable>
  );

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: t.c.bg }}>
      {!isPhone ? (
        <Sidebar
          current={current}
          logo={profile?.logoDataUrl}
          name={profile?.businessName}
        />
      ) : null}
      <View style={{ flex: 1 }}>
        <Row
          testID="topbar"
          justify="space-between"
          gap={12}
          style={{
            height: 60,
            paddingHorizontal: isPhone ? 12 : 20,
            backgroundColor: t.c.surface,
            borderBottomWidth: 1,
            borderBottomColor: t.c.border,
          }}
        >
          <Row gap={10} style={{ flexShrink: 1 }}>
            {isPhone ? (
              <Text variant="h3" numberOfLines={1} style={{ maxWidth: 140 }}>
                {profile?.businessName || "BharatRailGo"}
              </Text>
            ) : (
              searchButton
            )}
          </Row>
          <Row gap={8}>
            <BranchSwitcher compact={isPhone} />
            {isPhone ? searchButton : <UserMenu />}
          </Row>
        </Row>
        <View
          style={{
            paddingHorizontal: isPhone ? 12 : 20,
            paddingTop: 10,
            gap: 8,
          }}
        >
          <SubscriptionBanner />
        </View>
        <View style={{ flex: 1 }}>{children}</View>
        {isPhone ? <PhoneTabBar current={current} /> : null}
      </View>
      <CommandPalette />
    </View>
  );
}
