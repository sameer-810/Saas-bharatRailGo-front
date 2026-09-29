/** Small presentational pieces shared by the admin screens. */
import React from "react";
import { View } from "react-native";
import { Col, Row, StatusPill, Text } from "@shared/ui";
import { useTheme } from "@shared/useTheme";
import { formatDate, formatNumber } from "@shared/lib/format";
import type { AdminOrg, SubscriptionState } from "../api";

/** "Unlimited" for null limits. */
export function limitLabel(v: number | null | undefined) {
  return v == null ? "Unlimited" : formatNumber(v);
}

/** Approval + org status pills side by side. */
export function OrgPills({ org }: { org: Pick<AdminOrg, "approvalStatus" | "status"> }) {
  return (
    <Row gap={6} wrap>
      <StatusPill status={org.approvalStatus} />
      {org.approvalStatus === "approved" ? <StatusPill status={org.status} /> : null}
    </Row>
  );
}

/** Subscription status + computed state + days left. */
export function SubscriptionCell({ sub }: { sub: SubscriptionState }) {
  if (sub.status === "none") {
    return (
      <Text variant="caption" tone="faint">
        No subscription
      </Text>
    );
  }
  const days = sub.daysLeft;
  const daysText =
    days == null ? "No end date" : days > 0 ? `${days} day${days === 1 ? "" : "s"} left` : `Ended ${-days}d ago`;
  return (
    <Col gap={3}>
      <Row gap={6} wrap>
        <StatusPill status={sub.status} />
        {sub.state !== "ok" ? <StatusPill status={sub.state} /> : null}
      </Row>
      <Text variant="caption" tone={sub.state === "expired" ? "danger" : sub.state === "grace" ? "warning" : "faint"}>
        {sub.planCode ? `${sub.planCode} · ` : ""}
        {daysText}
        {sub.endsAt ? ` · ${formatDate(sub.endsAt)}` : ""}
      </Text>
    </Col>
  );
}

/** used / limit bar. Red when at or over the cap. */
export function UsageMeter({
  label,
  used,
  limit,
  testID,
}: {
  label: string;
  used: number;
  limit: number | null;
  testID?: string;
}) {
  const t = useTheme();
  const ratio = limit == null ? 0 : limit === 0 ? 1 : Math.min(1, used / limit);
  const color = limit == null ? t.c.textFaint : ratio >= 1 ? t.c.danger : ratio >= 0.8 ? t.c.warning : t.c.success;
  return (
    <Col gap={6} testID={testID} style={{ flexGrow: 1, flexBasis: 180 }}>
      <Row justify="space-between">
        <Text variant="caption" tone="muted">
          {label}
        </Text>
        <Text variant="caption" style={{ fontFamily: t.fonts.mono }}>
          {formatNumber(used)} / {limitLabel(limit)}
        </Text>
      </Row>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: t.c.surfaceAlt, overflow: "hidden" }}>
        <View style={{ width: `${limit == null ? 0 : ratio * 100}%`, height: 6, backgroundColor: color }} />
      </View>
    </Col>
  );
}

/** Compact one-line summary of an audit meta object. */
export function metaSummary(meta: unknown): string {
  if (meta == null) return "";
  if (typeof meta !== "object") return String(meta);
  const parts = Object.entries(meta as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      let s: string;
      if (v === null) s = "null";
      else if (Array.isArray(v)) s = `[${v.length}]`;
      else if (typeof v === "object") s = `{${Object.keys(v as object).join(",")}}`;
      else s = String(v);
      if (s.length > 40) s = `${s.slice(0, 39)}…`;
      return `${k}=${s}`;
    });
  return parts.join(" · ");
}
