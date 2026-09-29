/** Party outstanding with aging — GET /reports/outstanding (no params). */
import React, { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Hourglass } from "lucide-react-native";
import {
  Card,
  Col,
  DataList,
  EmptyState,
  ErrorState,
  Money,
  Row,
  Screen,
  SearchInput,
  SectionHeader,
  SegmentedControl,
  Skeleton,
  Text,
  type Column,
} from "@shared/ui";
import { useLayout, useTheme, type Theme } from "@shared/useTheme";
import { useApiGet } from "@shared/api/query";
import { apiErrorMessage } from "@shared/api/apiClient";
import { useAppNav } from "@navigation/useAppNav";
import { ExportButton, MonoNum } from "../components/ReportControls";
import { sum, type OutstandingRow } from "../types";

type BucketKey = "aged0to30" | "aged31to60" | "aged61to90" | "aged90Plus";

const BUCKETS: { key: BucketKey; label: string; short: string }[] = [
  { key: "aged0to30", label: "0–30 days", short: "0–30" },
  { key: "aged31to60", label: "31–60 days", short: "31–60" },
  { key: "aged61to90", label: "61–90 days", short: "61–90" },
  { key: "aged90Plus", label: "90+ days", short: "90+" },
];

/** Older money is more urgent, so the colour escalates with age. */
function bucketColor(t: Theme, k: BucketKey) {
  return { aged0to30: t.c.info, aged31to60: t.c.accent, aged61to90: t.c.warning, aged90Plus: t.c.danger }[k];
}

function AgingBar({ row, height = 8 }: { row: Pick<OutstandingRow, BucketKey>; height?: number }) {
  const t = useTheme();
  const total = BUCKETS.reduce((s, b) => s + Math.max(0, row[b.key]), 0);
  if (total <= 0) return <View style={{ height, borderRadius: height / 2, backgroundColor: t.c.surfaceAlt }} />;
  return (
    <Row gap={2} align="stretch" style={{ height, borderRadius: height / 2, overflow: "hidden", alignSelf: "stretch" }}>
      {BUCKETS.filter((b) => row[b.key] > 0).map((b) => (
        <View key={b.key} style={{ flex: row[b.key], backgroundColor: bucketColor(t, b.key) }} />
      ))}
    </Row>
  );
}

type Sort = "amount" | "oldest";

export function OutstandingReportScreen() {
  const t = useTheme();
  const nav = useAppNav();
  const { isPhone } = useLayout();
  const q = useApiGet<OutstandingRow[]>(["reports", "outstanding"], "/reports/outstanding");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("amount");
  const [bucket, setBucket] = useState<BucketKey | null>(null);

  const all = q.data;
  const totals = useMemo(
    () => ({
      grandTotal: sum(all, (r) => r.totalAmount),
      aged0to30: sum(all, (r) => r.aged0to30),
      aged31to60: sum(all, (r) => r.aged31to60),
      aged61to90: sum(all, (r) => r.aged61to90),
      aged90Plus: sum(all, (r) => r.aged90Plus),
      bilties: sum(all, (r) => r.consignmentCount),
    }),
    [all],
  );

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    let list = (all || []).filter(
      (r) =>
        !needle ||
        (r.partyName || "").toLowerCase().includes(needle) ||
        (r.partyCity || "").toLowerCase().includes(needle) ||
        (r.mobile || "").includes(needle),
    );
    if (bucket) list = list.filter((r) => r[bucket] > 0);
    if (sort === "oldest") {
      list = [...list].sort(
        (a, b) => b.aged90Plus - a.aged90Plus || b.aged61to90 - a.aged61to90 || b.aged31to60 - a.aged31to60 || b.totalAmount - a.totalAmount,
      );
    }
    return list;
  }, [all, search, sort, bucket]);

  const agedCell = (k: BucketKey) =>
    function AgedCell(r: OutstandingRow) {
      return r[k] > 0 ? (
        <Money value={r[k]} tone={k === "aged90Plus" ? "danger" : k === "aged61to90" ? "warning" : "default"} />
      ) : (
        <Text tone="faint">—</Text>
      );
    };

  const columns: Column<OutstandingRow>[] = [
    {
      key: "party",
      title: "Party",
      flex: 2,
      render: (r) => (
        <Col gap={1}>
          <Text variant="bodyStrong" tone={r.partyId ? "accent" : "default"} numberOfLines={1}>
            {r.partyName || "Unknown party"}
          </Text>
          <Text variant="caption" tone="faint" numberOfLines={1}>
            {[r.partyCity, r.mobile].filter(Boolean).join(" · ") || "—"}
          </Text>
        </Col>
      ),
    },
    { key: "cnt", title: "Bilties", align: "right", flex: 0.7, render: (r) => <MonoNum value={r.consignmentCount} /> },
    ...BUCKETS.map<Column<OutstandingRow>>((b) => ({
      key: b.key,
      title: b.short,
      align: "right",
      flex: 1.1,
      hideOnPhone: b.key === "aged0to30" || b.key === "aged31to60",
      render: agedCell(b.key),
    })),
    {
      key: "total",
      title: "Total due",
      align: "right",
      flex: 1.2,
      render: (r) => <Money value={r.totalAmount} style={{ fontFamily: t.fonts.monoBold }} />,
    },
    { key: "mix", title: "Aging", flex: 1.2, hideOnPhone: true, render: (r) => <AgingBar row={r} height={6} /> },
  ];

  const loading = q.isLoading;

  return (
    <Screen
      title="Party outstanding"
      subtitle="Unpaid to-pay and on-bill parcels, by how long they have been due"
      back
      backTo="Reports"
      testID="report-outstanding"
      actions={<ExportButton url="/reports/outstanding/export" filename="outstanding-report.xlsx" />}
    >
      {q.error ? (
        <ErrorState message={apiErrorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <Col gap={16}>
          <Card testID="aging-summary">
            <Row justify="space-between" align="flex-end" wrap gap={12}>
              <Col gap={2}>
                <Text variant="overline" tone="muted">
                  Total outstanding
                </Text>
                {loading ? (
                  <Skeleton height={34} width={200} />
                ) : (
                  <Money value={totals.grandTotal} variant={isPhone ? "h1" : "display"} />
                )}
                <Text variant="caption" tone="faint">
                  {loading ? " " : `${all?.length ?? 0} parties · ${totals.bilties} bilties`}
                </Text>
              </Col>
            </Row>
            <View style={{ marginTop: 16 }}>
              {loading ? <Skeleton height={14} /> : <AgingBar row={totals} height={14} />}
            </View>
            <Row wrap gap={10} style={{ marginTop: 14 }}>
              {BUCKETS.map((b) => {
                const value = totals[b.key];
                const pct = totals.grandTotal > 0 ? Math.round((value / totals.grandTotal) * 100) : 0;
                const active = bucket === b.key;
                return (
                  <Pressable
                    key={b.key}
                    testID={`aging-${b.key}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Filter parties with money due ${b.label}`}
                    onPress={() => setBucket(active ? null : b.key)}
                    style={({ hovered }: { hovered?: boolean }) => ({
                      flexGrow: 1,
                      flexBasis: isPhone ? 140 : 160,
                      padding: 12,
                      gap: 4,
                      borderRadius: t.radius.md,
                      borderWidth: 1,
                      borderColor: active ? bucketColor(t, b.key) : hovered ? t.c.borderStrong : t.c.border,
                      backgroundColor: active ? t.c.surfaceAlt : t.c.surface,
                    })}
                  >
                    <Row gap={6}>
                      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: bucketColor(t, b.key) }} />
                      <Text variant="label" tone="muted">
                        {b.label}
                      </Text>
                    </Row>
                    {loading ? <Skeleton height={20} width="60%" /> : <Money value={value} variant="h3" />}
                    <Text variant="caption" tone="faint">
                      {loading ? " " : `${pct}% of total`}
                    </Text>
                  </Pressable>
                );
              })}
            </Row>
          </Card>

          <SectionHeader title={bucket ? `Parties with money due ${BUCKETS.find((b) => b.key === bucket)?.label}` : "By party"} />
          <Row gap={12} wrap align="center">
            <View style={{ flex: 1, minWidth: 220 }}>
              <SearchInput value={search} onChangeText={setSearch} placeholder="Search party, city or mobile" testID="outstanding-search" />
            </View>
            <SegmentedControl<Sort>
              testID="outstanding-sort"
              value={sort}
              onChange={setSort}
              options={[
                { value: "amount", label: "Highest due" },
                { value: "oldest", label: "Oldest first" },
              ]}
            />
          </Row>

          <DataList
            testID="outstanding-list"
            rows={rows}
            loading={loading}
            columns={columns}
            keyOf={(r) => r.partyId || `${r.partyName}-${r.mobile}`}
            onRowPress={(r) => r.partyId && nav.navigate("PartyDetail", { id: String(r.partyId) })}
            phoneTitle={(r) => (
              <Col gap={6}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {r.partyName || "Unknown party"}
                </Text>
                <AgingBar row={r} height={6} />
              </Col>
            )}
            phoneRight={(r) => <Money value={r.totalAmount} style={{ fontFamily: t.fonts.monoBold }} />}
            empty={
              <EmptyState
                icon={Hourglass}
                title={all && all.length > 0 ? "No party matches" : "Nothing outstanding"}
                message={
                  all && all.length > 0
                    ? "Clear the search or the age filter to see every party."
                    : "Every to-pay and on-bill parcel has been paid. Nice work."
                }
              />
            }
          />
        </Col>
      )}
    </Screen>
  );
}
