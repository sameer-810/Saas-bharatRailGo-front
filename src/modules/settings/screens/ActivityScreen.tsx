/**
 * Activity log — who did what, when, from which device. Owner + manager.
 * Newest first; filter by person, kind of action, text and date. Rows that
 * point at a record open it. Refused attempts are shown in red.
 */
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { History } from "lucide-react-native";
import {
  Chip,
  Col,
  DataList,
  DateField,
  EmptyState,
  Row,
  Screen,
  SearchInput,
  Select,
  StatusPill,
  Text,
  type Column,
} from "@shared/ui";
import { useLayout, useTheme } from "@shared/useTheme";
import { useApiGet, useApiList } from "@shared/api/query";
import { apiErrorMessage } from "@shared/api/apiClient";
import { useDebounced } from "@shared/hooks/useDebounced";
import { formatDateTime } from "@shared/lib/format";
import { humanize } from "@shared/ui";
import { useAppNav } from "@navigation/useAppNav";
import type { TeamUser } from "../types";
import {
  ACTIVITY_GROUPS,
  describeAction,
  deviceOf,
  targetRoute,
  type ActivityEntry,
} from "../lib/activity";

export function ActivityScreen() {
  const t = useTheme();
  const nav = useAppNav();
  const { isPhone } = useLayout();
  const [group, setGroup] = useState("all");
  const [actor, setActor] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const q = useDebounced(text.trim());

  useEffect(() => setPage(1), [group, actor, q, from, to]);

  const users = useApiGet<TeamUser[]>(["users"], "/auth/users");
  const prefix = ACTIVITY_GROUPS.find((g) => g.key === group)?.prefix;
  const log = useApiList<ActivityEntry>("audit", "/audit", {
    page,
    limit: 30,
    action: prefix || undefined,
    actor: actor || undefined,
    q: q || undefined,
    from,
    to,
  });

  const columns: Column<ActivityEntry>[] = [
    {
      key: "what",
      title: "What",
      flex: 2.2,
      render: (r) => (
        <Col gap={2}>
          <Row gap={8} wrap>
            <Text variant="bodyStrong" numberOfLines={1}>
              {describeAction(r.action)}
            </Text>
            {r.outcome === "denied" ? (
              <StatusPill status="denied" label="Refused" />
            ) : null}
          </Row>
          {r.label ? (
            <Text
              variant="caption"
              tone={targetRoute(r) ? "accent" : "muted"}
              numberOfLines={1}
            >
              {r.label}
            </Text>
          ) : null}
          {r.fields.length ? (
            <Text variant="caption" tone="faint" numberOfLines={1}>
              Changed: {r.fields.map((f) => humanize(f)).join(", ")}
            </Text>
          ) : null}
        </Col>
      ),
    },
    {
      key: "who",
      title: "Who",
      flex: 1.2,
      render: (r) => (
        <Col gap={2}>
          <Text numberOfLines={1}>{r.actor?.name || "—"}</Text>
          {r.actor?.role ? (
            <Text variant="caption" tone="muted">
              {humanize(r.actor.role)}
            </Text>
          ) : null}
        </Col>
      ),
    },
    {
      key: "when",
      title: "When",
      flex: 1.1,
      render: (r) => (
        <Text variant="caption" tone="muted">
          {formatDateTime(r.at)}
        </Text>
      ),
    },
    {
      key: "where",
      title: "Device",
      flex: 1.2,
      hideOnPhone: true,
      render: (r) => (
        <Col gap={2}>
          <Text variant="caption" numberOfLines={1}>
            {deviceOf(r.userAgent) || "—"}
          </Text>
          {r.ip ? (
            <Text
              variant="caption"
              tone="faint"
              style={{ fontFamily: t.fonts.mono }}
              numberOfLines={1}
            >
              {r.ip.replace(/^::ffff:/, "")}
            </Text>
          ) : null}
        </Col>
      ),
    },
  ];

  const userOptions = (users.data || []).map((u) => ({
    value: u.id,
    label: u.name,
    hint: humanize(u.role),
  }));

  return (
    <Screen
      title="Activity log"
      subtitle={
        log.data
          ? `${log.data.meta.total} entries · kept for 1 year`
          : "Who did what, and when"
      }
      back
      backTo="Settings"
      testID="activity-screen"
      refreshing={log.isRefetching}
      onRefresh={() => log.refetch()}
    >
      <Col gap={12} style={{ marginBottom: 16 }}>
        <Row gap={10} wrap align="flex-end">
          <View style={{ flexGrow: 1, flexBasis: 260, minWidth: 220 }}>
            <SearchInput
              testID="activity-search"
              value={text}
              onChangeText={setText}
              placeholder="Search bill no., party, person…"
            />
          </View>
          <View
            style={{
              flexGrow: 1,
              flexBasis: 200,
              minWidth: 180,
              maxWidth: isPhone ? undefined : 260,
            }}
          >
            <Select
              testID="activity-person"
              placeholder="Everyone"
              value={actor}
              options={userOptions}
              onChange={setActor}
              clearable
            />
          </View>
          <View style={{ minWidth: 160 }}>
            <DateField
              testID="activity-from"
              label="From"
              value={from}
              onChange={setFrom}
              quick={false}
            />
          </View>
          <View style={{ minWidth: 160 }}>
            <DateField
              testID="activity-to"
              label="To"
              value={to}
              onChange={setTo}
              quick={false}
            />
          </View>
        </Row>
        <Row gap={6} wrap testID="activity-groups">
          {ACTIVITY_GROUPS.map((g) => (
            <Chip
              key={g.key}
              label={g.label}
              selected={group === g.key}
              onPress={() => setGroup(g.key)}
              testID={`activity-group-${g.key}`}
            />
          ))}
        </Row>
      </Col>
      <DataList
        testID="activity-list"
        rows={log.data?.items}
        columns={columns}
        keyOf={(r) => r.id}
        loading={log.isLoading}
        error={log.error ? { message: apiErrorMessage(log.error) } : undefined}
        onRetry={() => log.refetch()}
        paging={log.data?.meta}
        onPage={setPage}
        onRowPress={(r) => {
          const target = targetRoute(r);
          if (target) nav.navigate(target.route, { id: target.id });
        }}
        phoneRight={(r) => (
          <Text variant="caption" tone="muted">
            {formatDateTime(r.at)}
          </Text>
        )}
        empty={
          <EmptyState
            icon={History}
            title="Nothing here yet"
            message="Bookings, bills, payments, exports and sign-ins by your team will appear here."
          />
        }
      />
    </Screen>
  );
}
