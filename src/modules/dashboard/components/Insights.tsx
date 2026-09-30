/** Secondary dashboard cards: recent bookings, top stations, pending by train, payment-mode mix. */
import React, { useState } from "react";
import { Pressable, View } from "react-native";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  TrainFront,
} from "lucide-react-native";
import {
  Button,
  Card,
  Col,
  Divider,
  EmptyState,
  Money,
  Row,
  SectionHeader,
  Skeleton,
  StatusPill,
  Text,
} from "@shared/ui";
import { useTheme } from "@shared/useTheme";
import { formatDate } from "@shared/lib/format";
import {
  PAYMENT_MODE_LABEL,
  type DashboardMetrics,
  type PendingTrain,
  type RecentConsignment,
} from "../types";

function Code({ children }: { children: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        minWidth: 52,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: t.radius.sm,
        backgroundColor: t.c.surfaceAlt,
        alignItems: "center",
      }}
    >
      <Text
        variant="mono"
        style={{ fontFamily: t.fonts.monoBold, fontSize: 13 }}
      >
        {children}
      </Text>
    </View>
  );
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Col gap={10}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={36} />
      ))}
    </Col>
  );
}

/* ───────────── Recent bookings ───────────── */

export function RecentBookings({
  rows,
  loading,
  onOpen,
  onAll,
  onNew,
  canCreate,
}: {
  rows: RecentConsignment[] | undefined;
  loading: boolean;
  onOpen: (id: string) => void;
  onAll: () => void;
  onNew: () => void;
  canCreate: boolean;
}) {
  const t = useTheme();
  return (
    <Card testID="recent-bookings">
      <SectionHeader
        title="Recent bookings"
        action={
          <Button
            title="View all"
            variant="ghost"
            size="sm"
            onPress={onAll}
            testID="recent-view-all"
          />
        }
      />
      {loading && !rows ? (
        <ListSkeleton />
      ) : !rows || rows.length === 0 ? (
        <EmptyState
          title="No bookings yet"
          message="Your latest bookings will show up here."
          action={
            canCreate ? (
              <Button
                title="New booking"
                icon={Plus}
                onPress={onNew}
                testID="recent-new-booking"
              />
            ) : undefined
          }
        />
      ) : (
        <Col gap={0}>
          {rows.map((c, i) => (
            <Pressable
              key={c.id}
              testID={`recent-row-${c.id}`}
              accessibilityRole="button"
              onPress={() => onOpen(c.id)}
              style={({ hovered }: { hovered?: boolean }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 10,
                paddingHorizontal: 8,
                marginHorizontal: -8,
                borderRadius: t.radius.md,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: t.c.border,
                backgroundColor: hovered ? t.c.surfaceAlt : "transparent",
              })}
            >
              <Code>{String(c.destinationStation || "—").toUpperCase()}</Code>
              <Col gap={1} flex={1}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {c.party?.name ?? "—"}
                </Text>
                <Text variant="caption" tone="faint" numberOfLines={1}>
                  {formatDate(c.date)} · {c.packages} pkg ·{" "}
                  {PAYMENT_MODE_LABEL[c.paymentMode] ?? c.paymentMode}
                </Text>
              </Col>
              <Col gap={4} align="flex-end">
                <Money value={c.totalAmount} />
                <StatusPill status={c.paymentStatus} />
              </Col>
            </Pressable>
          ))}
        </Col>
      )}
    </Card>
  );
}

/* ───────────── Top stations (this month) ───────────── */

export function TopStations({
  rows,
  loading,
  onStation,
}: {
  rows: DashboardMetrics["topStations"] | undefined;
  loading: boolean;
  onStation: (code: string) => void;
}) {
  const t = useTheme();
  const max = Math.max(1, ...(rows || []).map((r) => r.revenue));
  return (
    <Card testID="top-stations">
      <SectionHeader title="Top destinations · this month" />
      {loading && !rows ? (
        <ListSkeleton rows={3} />
      ) : !rows || rows.length === 0 ? (
        <Text tone="faint">No bookings this month yet.</Text>
      ) : (
        <Col gap={12}>
          {rows.map((r) => (
            <Pressable
              key={r.station}
              testID={`top-station-${r.station}`}
              accessibilityRole="button"
              onPress={() => onStation(r.station)}
            >
              <Row gap={10}>
                <Code>{String(r.station || "—").toUpperCase()}</Code>
                <Col gap={4} flex={1}>
                  <Row justify="space-between">
                    <Text variant="caption" tone="muted">
                      {r.consignments} bkg · {r.packages} pkg
                    </Text>
                    <Money value={r.revenue} variant="label" />
                  </Row>
                  <View
                    style={{
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: t.c.surfaceAlt,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        width: `${(r.revenue / max) * 100}%`,
                        height: "100%",
                        backgroundColor: t.c.accent,
                      }}
                    />
                  </View>
                </Col>
              </Row>
            </Pressable>
          ))}
        </Col>
      )}
    </Card>
  );
}

/* ───────────── Payment-mode mix (this month) ───────────── */

export function ModeMix({
  rows,
  loading,
}: {
  rows: DashboardMetrics["paymentModeMix"] | undefined;
  loading: boolean;
}) {
  const t = useTheme();
  const total = (rows || []).reduce((s, r) => s + r.amount, 0);
  const sorted = [...(rows || [])].sort((a, b) => b.amount - a.amount);
  const shade = (i: number) => [1, 0.7, 0.45, 0.25][i] ?? 0.2;
  return (
    <Card testID="mode-mix">
      <SectionHeader title="How parcels are paid · this month" />
      {loading && !rows ? (
        <Skeleton height={60} />
      ) : sorted.length === 0 || total === 0 ? (
        <Text tone="faint">Nothing booked this month yet.</Text>
      ) : (
        <Col gap={12}>
          <Row
            gap={2}
            align="stretch"
            style={{ height: 12, borderRadius: 6, overflow: "hidden" }}
          >
            {sorted.map((r, i) => (
              <View
                key={r.mode}
                style={{
                  flex: r.amount || 0.0001,
                  backgroundColor: t.c.accent,
                  opacity: shade(i),
                }}
              />
            ))}
          </Row>
          <Row wrap gap={14}>
            {sorted.map((r, i) => (
              <Row key={r.mode} gap={6}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    backgroundColor: t.c.accent,
                    opacity: shade(i),
                  }}
                />
                <Text variant="caption" tone="muted">
                  {PAYMENT_MODE_LABEL[r.mode] ?? r.mode} ·{" "}
                  {Math.round((r.amount / total) * 100)}% ({r.count})
                </Text>
              </Row>
            ))}
          </Row>
        </Col>
      )}
    </Card>
  );
}

/* ───────────── Pending by train ───────────── */

function TrainRow({
  train,
  onParty,
}: {
  train: PendingTrain;
  onParty: (id: string) => void;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const due = train.parties.reduce((s, p) => s + p.amount, 0);
  return (
    <Col gap={0}>
      <Pressable
        testID={`train-row-${train.trainNumber}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingVertical: 10,
        }}
      >
        <TrainFront size={16} color={t.c.textMuted} />
        <Text
          variant="mono"
          style={{ fontFamily: t.fonts.monoBold, minWidth: 60 }}
        >
          {train.trainNumber}
        </Text>
        <Text
          variant="caption"
          tone="muted"
          style={{ flex: 1 }}
          numberOfLines={1}
        >
          {train.partyCount} {train.partyCount === 1 ? "party" : "parties"} ·{" "}
          {train.consignmentCount} bkg
        </Text>
        <Money value={due} variant="label" />
        {open ? (
          <ChevronDown size={16} color={t.c.textFaint} />
        ) : (
          <ChevronRight size={16} color={t.c.textFaint} />
        )}
      </Pressable>
      {open ? (
        <Col gap={6} style={{ paddingLeft: 26, paddingBottom: 10 }}>
          {train.parties.map((p, i) => (
            <Pressable
              key={`${p.id ?? "x"}-${i}`}
              testID={`train-party-${train.trainNumber}-${p.id ?? i}`}
              disabled={!p.id}
              onPress={() => p.id && onParty(String(p.id))}
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Col gap={0} flex={1}>
                <Text
                  variant="label"
                  tone={p.id ? "accent" : "default"}
                  numberOfLines={1}
                >
                  {p.name}
                </Text>
                <Text variant="caption" tone="faint" numberOfLines={1}>
                  {p.consignments} bkg · {p.packages} pkg
                  {p.stations.length ? ` · ${p.stations.join(", ")}` : ""}
                </Text>
              </Col>
              <Money value={p.amount} variant="caption" />
            </Pressable>
          ))}
        </Col>
      ) : null}
    </Col>
  );
}

export function PendingByTrain({
  rows,
  loading,
  onParty,
}: {
  rows: PendingTrain[] | undefined;
  loading: boolean;
  onParty: (id: string) => void;
}) {
  const [all, setAll] = useState(false);
  if (!loading && (!rows || rows.length === 0)) return null;
  const list = all ? rows || [] : (rows || []).slice(0, 5);
  return (
    <Card testID="pending-by-train">
      <SectionHeader title="Unpaid by train" />
      {loading && !rows ? (
        <ListSkeleton rows={3} />
      ) : (
        <Col gap={0}>
          {list.map((tr, i) => (
            <View key={tr.trainNumber}>
              {i > 0 ? <Divider /> : null}
              <TrainRow train={tr} onParty={onParty} />
            </View>
          ))}
          {(rows || []).length > 5 ? (
            <Button
              title={
                all ? "Show fewer" : `Show all ${(rows || []).length} trains`
              }
              variant="ghost"
              size="sm"
              onPress={() => setAll((v) => !v)}
              testID="trains-toggle"
            />
          ) : null}
        </Col>
      )}
    </Card>
  );
}
