/** Settings hub — grouped cards, filtered by what the role can use. */
import React from "react";
import { View } from "react-native";
import {
  Building2,
  ChevronRight,
  Gauge,
  History,
  ShieldCheck,
  MapPin,
  Palette,
  Receipt,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react-native";
import { useTheme } from "@shared/useTheme";
import {
  Card,
  Col,
  Row,
  SectionHeader,
  Screen,
  StatusPill,
  Text,
} from "@shared/ui";
import { useCan } from "@shared/lib/permissions";
import { useAppNav } from "@navigation/useAppNav";
import type { AppRoute } from "@navigation/routes";
import { useSubscription } from "../components/common";
import { BackupCard } from "../components/BackupCard";

interface Item {
  route: AppRoute;
  title: string;
  description: string;
  icon: LucideIcon;
  testID: string;
  badge?: string;
}

function HubCard({ item }: { item: Item }) {
  const t = useTheme();
  const nav = useAppNav();
  const Icon = item.icon;
  return (
    <View style={{ flexGrow: 1, flexBasis: 300, minWidth: 240 }}>
      <Card
        testID={item.testID}
        onPress={() => nav.navigate(item.route)}
        style={{ height: "100%" }}
      >
        <Row gap={14} align="flex-start">
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: t.radius.md,
              backgroundColor: t.c.accentSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon size={20} color={t.c.accent} />
          </View>
          <Col gap={4} flex={1}>
            <Row gap={8} wrap>
              <Text variant="h3">{item.title}</Text>
              {item.badge ? (
                <Text variant="caption" tone="faint">
                  {item.badge}
                </Text>
              ) : null}
            </Row>
            <Text variant="caption" tone="muted">
              {item.description}
            </Text>
          </Col>
          <ChevronRight size={18} color={t.c.textFaint} />
        </Row>
      </Card>
    </View>
  );
}

function Group({ title, items }: { title: string; items: Item[] }) {
  if (!items.length) return null;
  return (
    <Col gap={0} style={{ marginBottom: 18 }}>
      <SectionHeader title={title} />
      <Row wrap gap={12} align="stretch">
        {items.map((i) => (
          <HubCard key={i.route} item={i} />
        ))}
      </Row>
    </Col>
  );
}

export function SettingsScreen() {
  const isOwner = useCan("settings.manage");
  const canUsers = useCan("users.manage");
  const canMasters = useCan("masters.manage");
  const canBranches = useCan("branches.manage");
  const canAudit = useCan("audit.view");
  const { sub } = useSubscription();

  const business: Item[] = [];
  if (canUsers) {
    // owner + manager (manager sees the profile read-only)
    business.push({
      route: "SettingsBusiness",
      title: "Business profile",
      description: isOwner
        ? "Name, GSTIN, addresses, bank details, tax rates, bill & bilti numbering, payment receivers."
        : "Agency details, tax rates and numbering (view only).",
      icon: Building2,
      testID: "settings-card-business",
      badge: isOwner ? undefined : "View only",
    });
  }
  if (isOwner) {
    business.push({
      route: "SettingsBranding",
      title: "Branding",
      description:
        "Logo, brand colour for the app and bilti, and light / dark theme.",
      icon: Palette,
      testID: "settings-card-branding",
    });
  }

  const people: Item[] = [];
  if (canUsers) {
    people.push({
      route: "Team",
      title: "Team",
      description: isOwner
        ? "Add managers and staff, reset passwords, assign branches."
        : "Add staff, reset passwords, assign branches.",
      icon: Users,
      testID: "settings-card-team",
      badge: sub?.limits
        ? usageBadge(sub.usage?.users, sub.limits.maxUsers, "users")
        : undefined,
    });
  }
  if (canUsers) {
    people.push({
      route: "Branches",
      title: "Branches",
      description: canBranches
        ? "Head office and branch counters, codes and stations."
        : "Branch list (view only).",
      icon: Store,
      testID: "settings-card-branches",
      badge: sub?.limits
        ? usageBadge(sub.usage?.branches, sub.limits.maxBranches, "branches")
        : undefined,
    });
  }

  const masters: Item[] = [
    {
      route: "Stations",
      title: "Stations",
      description: canMasters
        ? "Railway station codes used on bookings and rates."
        : "Railway station codes (view only).",
      icon: MapPin,
      testID: "settings-card-stations",
    },
    {
      route: "Rates",
      title: "Rate card",
      description: canMasters
        ? "Freight, hamali and other charge heads, plus a quick quote tester."
        : "Charge heads and the quote tester (view only).",
      icon: Receipt,
      testID: "settings-card-rates",
    },
  ];

  const account: Item[] = [
    {
      route: "Plan",
      title: "Plan & usage",
      description: sub?.planName
        ? `${sub.planName}${sub.daysLeft != null ? ` · ${Math.max(sub.daysLeft, 0)} days left` : ""}`
        : "Your plan, limits and usage this month.",
      icon: Gauge,
      testID: "settings-card-plan",
    },
  ];

  if (canAudit) {
    account.push({
      route: "Activity",
      title: "Activity log",
      description:
        "Who created, edited, deleted, exported or signed in — and when.",
      icon: History,
      testID: "settings-card-activity",
    });
  }
  if (isOwner) {
    account.push({
      route: "Privacy",
      title: "Privacy & data",
      description:
        "Download all your data, see your consent record, or close the account.",
      icon: ShieldCheck,
      testID: "settings-card-privacy",
    });
  }

  return (
    <Screen
      title="Settings"
      subtitle="Set up your agency once — everything else follows."
      testID="settings-screen"
    >
      {sub ? (
        <Row gap={8} style={{ marginBottom: 12 }}>
          <StatusPill
            status={sub.state}
            label={sub.state === "ok" ? "Subscription active" : undefined}
          />
          {sub.planName ? (
            <Text variant="caption" tone="muted">
              {sub.planName}
            </Text>
          ) : null}
        </Row>
      ) : null}
      <Group title="Business" items={business} />
      <Group title="People & branches" items={people} />
      <Group title="Masters" items={masters} />
      <Group title="Account" items={account} />
      {isOwner ? <BackupCard /> : null}
    </Screen>
  );
}

function usageBadge(
  used: number | undefined,
  limit: number | null,
  noun: string,
) {
  return limit == null ? undefined : `${used ?? 0}/${limit} ${noun}`;
}
