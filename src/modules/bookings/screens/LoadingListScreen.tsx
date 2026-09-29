/**
 * Loading list — GET /consignments/daily-loading-list/:date. Built to be
 * printed or checked on the platform: large monospace rows and tick boxes
 * (kept in local state, per date). The API groups by destination; the screen
 * can regroup by train / bogie.
 */
import React, { useMemo, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { Check, ChevronLeft, ChevronRight, PackagePlus, Printer, RotateCcw } from "lucide-react-native";
import {
  Board,
  BoardText,
  Button,
  Card,
  Col,
  DateField,
  EmptyState,
  ErrorState,
  FlapText,
  IconButton,
  LoadingBlock,
  Row,
  Screen,
  SegmentedControl,
  Text,
} from "@shared/ui";
import { useLayout, useTheme } from "@shared/useTheme";
import { useApiGet } from "@shared/api/query";
import { apiErrorMessage } from "@shared/api/apiClient";
import { addDays, formatDate, formatMoney, formatNumber, isoDay } from "@shared/lib/format";
import { useAppNav, useParams } from "@navigation/useAppNav";
import { PAYMENT_MODE_LABEL, partyName, type Consignment, type LoadingList } from "../lib/types";

type GroupBy = "station" | "train";

interface Group {
  key: string;
  title: string;
  subtitle?: string;
  consignments: Consignment[];
  totals: { packages: number; weight: number; amount: number };
}

function shift(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number);
  return isoDay(addDays(new Date(y, (m || 1) - 1, d || 1), n));
}

function totalsOf(list: Consignment[]) {
  return list.reduce(
    (a, c) => ({
      packages: a.packages + (c.packages || 0),
      weight: a.weight + (c.chargeableWeight || 0),
      amount: a.amount + (c.totalAmount || 0),
    }),
    { packages: 0, weight: 0, amount: 0 },
  );
}

export function LoadingListScreen() {
  const t = useTheme();
  const { isPhone } = useLayout();
  const nav = useAppNav();
  const params = useParams<{ date: string }>();
  const [date, setDate] = useState<string>(params.date ? String(params.date) : isoDay());
  const [groupBy, setGroupBy] = useState<GroupBy>("station");
  const [ticks, setTicks] = useState<Record<string, Record<string, boolean>>>({});
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const q = useApiGet<LoadingList>(
    ["consignments", "loading-list", date],
    valid ? `/consignments/daily-loading-list/${date}` : null,
  );
  const mono = { fontFamily: t.fonts.mono, fontVariant: ["tabular-nums" as const] };
  const ticked = ticks[date] || {};
  const toggle = (id: string) =>
    setTicks((all) => ({ ...all, [date]: { ...(all[date] || {}), [id]: !(all[date] || {})[id] } }));

  const groups: Group[] = useMemo(() => {
    const data = q.data;
    if (!data) return [];
    if (groupBy === "station") {
      return data.stations.map((s) => ({
        key: s.station,
        title: s.station,
        consignments: s.consignments,
        totals: s.totals,
      }));
    }
    const map = new Map<string, Consignment[]>();
    for (const s of data.stations) {
      for (const c of s.consignments) {
        const k = [c.trainNumber?.trim() || "", c.bogieNumber?.trim() || ""].join("|");
        map.set(k, [...(map.get(k) || []), c]);
      }
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a === "|" ? 1 : b === "|" ? -1 : a.localeCompare(b)))
      .map(([k, list]) => {
        const [train, bogie] = k.split("|");
        return {
          key: k,
          title: train ? `TR ${train}` : "NO TRAIN",
          subtitle: bogie ? `Bogie ${bogie}` : train ? "Bogie not set" : "Train / bogie not entered",
          consignments: list,
          totals: totalsOf(list),
        };
      });
  }, [q.data, groupBy]);

  const all = groups.flatMap((g) => g.consignments);
  const doneCount = all.filter((c) => ticked[c.id]).length;
  const donePkgs = all.filter((c) => ticked[c.id]).reduce((a, c) => a + (c.packages || 0), 0);
  const grand = q.data?.grandTotals;

  const print = () => {
    const w = globalThis as unknown as { print?: () => void };
    if (Platform.OS === "web" && typeof w.print === "function") w.print();
  };

  return (
    <Screen
      title="Loading list"
      subtitle={valid ? formatDate(date) : undefined}
      back
      backTo="Bookings"
      testID="loading-list-screen"
      refreshing={q.isRefetching}
      onRefresh={q.refetch}
      actions={
        <>
          {Object.keys(ticked).length ? (
            <Button
              title="Clear ticks"
              variant="ghost"
              icon={RotateCcw}
              size={isPhone ? "sm" : "md"}
              onPress={() => setTicks((a) => ({ ...a, [date]: {} }))}
              testID="loading-clear-ticks"
            />
          ) : null}
          {Platform.OS === "web" ? (
            <Button
              title="Print"
              variant="secondary"
              icon={Printer}
              size={isPhone ? "sm" : "md"}
              onPress={print}
              testID="loading-print"
            />
          ) : null}
        </>
      }
    >
      <Col gap={16}>
        <Row gap={8} align="flex-end" wrap justify="space-between">
          <Row gap={8} align="flex-end">
            <IconButton icon={ChevronLeft} label="Previous day" testID="loading-prev" onPress={() => valid && setDate(shift(date, -1))} />
            <View style={{ minWidth: 200 }}>
              <DateField testID="loading-date" label="Date" value={date} onChange={setDate} />
            </View>
            <IconButton icon={ChevronRight} label="Next day" testID="loading-next" onPress={() => valid && setDate(shift(date, 1))} />
          </Row>
          <SegmentedControl<GroupBy>
            testID="loading-group"
            value={groupBy}
            onChange={setGroupBy}
            options={[
              { value: "station", label: "By destination" },
              { value: "train", label: "By train / bogie" },
            ]}
          />
        </Row>

        {!valid ? (
          <Text tone="danger">Enter a date as YYYY-MM-DD</Text>
        ) : q.isLoading ? (
          <LoadingBlock rows={6} />
        ) : q.error ? (
          <ErrorState message={apiErrorMessage(q.error)} onRetry={q.refetch} />
        ) : !grand || grand.totalConsignments === 0 ? (
          <EmptyState
            title={`Nothing to load on ${formatDate(date)}`}
            message="Bookings for this date will appear here, grouped for the platform."
            action={<Button title="New booking" icon={PackagePlus} onPress={() => nav.navigate("BookingNew")} testID="loading-new" />}
          />
        ) : (
          <>
            <Board
              testID="loading-grand"
              title={`Loading · ${formatDate(date)}`}
              right={<BoardText>{`${doneCount}/${grand.totalConsignments} LOADED`}</BoardText>}
            >
              <Row gap={20} wrap>
                <BoardText size={18}>{`${grand.totalConsignments} BKG`}</BoardText>
                <BoardText size={18}>{`${grand.packages} PKG`}</BoardText>
                <BoardText size={18}>{`${formatNumber(grand.weight)} KG`}</BoardText>
                <BoardText size={18} dim>{`${donePkgs}/${grand.packages} PKG TICKED`}</BoardText>
              </Row>
            </Board>

            {groups.map((g) => {
              const gDone = g.consignments.filter((c) => ticked[c.id]).length;
              const complete = gDone === g.consignments.length;
              return (
                <Col key={g.key} gap={0} testID={`loading-group-${g.key}`}>
                  <Board
                    style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
                    right={<BoardText dim={!complete}>{`${gDone}/${g.consignments.length}${complete ? " ✓" : ""}`}</BoardText>}
                  >
                    <Row gap={14} wrap align="center">
                      {groupBy === "station" ? (
                        <FlapText text={g.title} width={Math.max(4, g.title.length)} size={isPhone ? 18 : 22} />
                      ) : (
                        <BoardText size={isPhone ? 18 : 22}>{g.title}</BoardText>
                      )}
                      {g.subtitle ? <BoardText dim>{g.subtitle.toUpperCase()}</BoardText> : null}
                      <BoardText>{`${g.totals.packages} PKG · ${formatNumber(g.totals.weight)} KG`}</BoardText>
                    </Row>
                  </Board>
                  <Card padding={0} style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                    {g.consignments.map((c, i) => {
                      const on = !!ticked[c.id];
                      return (
                        <Pressable
                          key={c.id}
                          testID={`loading-row-${c.id}`}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: on }}
                          accessibilityLabel={`${partyName(c)} ${c.packages} packages`}
                          onPress={() => toggle(c.id)}
                          style={({ hovered }: { hovered?: boolean }) => ({
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 14,
                            paddingHorizontal: 14,
                            paddingVertical: 12,
                            borderTopWidth: i === 0 ? 0 : 1,
                            borderTopColor: t.c.border,
                            backgroundColor: on ? t.c.successSoft : hovered ? t.c.surfaceAlt : "transparent",
                          })}
                        >
                          <View
                            testID={`loading-tick-${c.id}`}
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 6,
                              borderWidth: 2,
                              borderColor: on ? t.c.success : t.c.borderStrong,
                              backgroundColor: on ? t.c.success : t.c.surface,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {on ? <Check size={20} color={t.c.surface} /> : null}
                          </View>
                          <Text style={[mono, { fontSize: 24, lineHeight: 30, minWidth: 54 }]} tone={on ? "muted" : "default"}>
                            {c.packages}
                            <Text variant="caption" tone="faint">
                              {" "}pkg
                            </Text>
                          </Text>
                          <Col gap={2} flex={1}>
                            <Text
                              variant="bodyStrong"
                              numberOfLines={1}
                              style={{ fontSize: 17, textDecorationLine: on ? "line-through" : "none" }}
                            >
                              {partyName(c)}
                            </Text>
                            <Text variant="caption" tone="muted" style={mono} numberOfLines={isPhone ? 2 : 1}>
                              {[
                                `${formatNumber(c.chargeableWeight)} kg`,
                                groupBy === "train" ? `→ ${c.destinationStation}` : null,
                                c.railwayReceiptNumber ? `RR ${c.railwayReceiptNumber}` : null,
                                groupBy === "station" && (c.trainNumber || c.bogieNumber)
                                  ? `TR ${c.trainNumber || "—"}/${c.bogieNumber || "—"}`
                                  : null,
                                c.contents || null,
                              ]
                                .filter(Boolean)
                                .join("  ·  ")}
                            </Text>
                          </Col>
                          {!isPhone ? (
                            <Col gap={0} align="flex-end">
                              <Text style={mono}>{formatMoney(c.totalAmount)}</Text>
                              <Text variant="caption" tone="faint">
                                {PAYMENT_MODE_LABEL[c.paymentMode]}
                              </Text>
                            </Col>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </Card>
                </Col>
              );
            })}
          </>
        )}
      </Col>
    </Screen>
  );
}
