/**
 * The centrepiece: today's bookings as a station departure board, one row per
 * destination station.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Plus, RotateCw } from "lucide-react-native";
import { Board, BoardText, Button, FlapText, Row, Col, Text } from "@shared/ui";
import { useLayout, useTheme } from "@shared/useTheme";
import { STATUS_TONE } from "@shared/theme";
import { formatNumber } from "@shared/lib/format";
import type { BoardConsignment } from "../types";

export interface StationGroup {
  station: string;
  count: number;
  packages: number;
  weight: number;
  amount: number;
  statuses: Record<string, number>;
}

const STATUS_ORDER = ["received", "loaded", "in_transit", "unloaded", "delivered", "returned"];

export function groupByStation(rows: BoardConsignment[]): StationGroup[] {
  const map = new Map<string, StationGroup>();
  for (const c of rows) {
    const code = String(c.destinationStation || "—").toUpperCase();
    let g = map.get(code);
    if (!g) {
      g = { station: code, count: 0, packages: 0, weight: 0, amount: 0, statuses: {} };
      map.set(code, g);
    }
    g.count += 1;
    g.packages += c.packages || 0;
    g.weight += c.chargeableWeight || c.actualWeight || 0;
    g.amount += c.totalAmount || 0;
    const s = c.deliveryStatus || "received";
    g.statuses[s] = (g.statuses[s] || 0) + 1;
  }
  return [...map.values()].sort((a, b) => b.packages - a.packages || a.station.localeCompare(b.station));
}

/** A one-word board remark that summarises the status mix. */
function remarkFor(g: StationGroup): string {
  const s = g.statuses;
  if ((s.delivered || 0) === g.count) return "DELIVERED";
  if (s.returned) return "RETURNS";
  if (s.in_transit) return "IN TRANSIT";
  if (s.unloaded) return "ARRIVED";
  if (s.loaded) return (s.loaded || 0) === g.count ? "LOADED" : "LOADING";
  return "BOOKING";
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const h = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(h);
  }, []);
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function StatusMix({ g }: { g: StationGroup }) {
  const t = useTheme();
  const tone = (s: string) => {
    const k = STATUS_TONE[s] ?? "neutral";
    return k === "neutral" ? t.c.boardDim : t.c[k];
  };
  return (
    <Row gap={2} align="stretch" style={{ height: 6, borderRadius: 3, overflow: "hidden", alignSelf: "stretch" }}>
      {STATUS_ORDER.filter((s) => g.statuses[s]).map((s) => (
        <View key={s} style={{ flex: g.statuses[s], backgroundColor: tone(s) }} />
      ))}
    </Row>
  );
}

export function DepartureBoard({
  rows,
  loading,
  error,
  onRetry,
  truncated,
  stationOrigin,
  onStation,
  onNewBooking,
  canCreate,
}: {
  rows: BoardConsignment[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  truncated?: boolean;
  stationOrigin?: string;
  onStation: (code: string) => void;
  onNewBooking: () => void;
  canCreate: boolean;
}) {
  const t = useTheme();
  const { isPhone } = useLayout();
  const clock = useClock();
  const groups = useMemo(() => groupByStation(rows || []), [rows]);
  const codeWidth = Math.min(6, Math.max(4, ...groups.map((g) => g.station.length)));
  const flapSize = isPhone ? 14 : 17;
  const totals = groups.reduce(
    (a, g) => ({ count: a.count + g.count, packages: a.packages + g.packages, weight: a.weight + g.weight }),
    { count: 0, packages: 0, weight: 0 },
  );

  const title = `Departures today${stationOrigin ? ` · ${stationOrigin}` : ""}`;
  const right = (
    <Row gap={8}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.c.boardText }} />
      <BoardText size={13}>{clock}</BoardText>
    </Row>
  );

  const headCell = (label: string, flex: number, align: "left" | "right" = "left") => (
    <View style={{ flex, alignItems: align === "right" ? "flex-end" : "flex-start" }}>
      <BoardText dim size={11}>
        {label}
      </BoardText>
    </View>
  );

  let body: React.ReactNode;
  if (error) {
    body = (
      <Col gap={12} align="center" style={{ paddingVertical: 28 }}>
        <FlapText text="DELAYED" size={flapSize} />
        <BoardText dim>Could not load today&apos;s bookings.</BoardText>
        <Button title="Try again" variant="secondary" size="sm" icon={RotateCw} onPress={onRetry} testID="board-retry" />
      </Col>
    );
  } else if (loading && !rows) {
    body = (
      <Col gap={8} testID="board-loading">
        {[0, 1, 2, 3].map((i) => (
          <Row key={i} gap={10} style={{ paddingVertical: 6 }}>
            <View style={{ width: 90, height: 22, borderRadius: 3, backgroundColor: t.c.boardCell }} />
            <View style={{ flex: 1, height: 10, borderRadius: 3, backgroundColor: t.c.boardCell }} />
          </Row>
        ))}
      </Col>
    );
  } else if (groups.length === 0) {
    body = (
      <Col gap={14} align="center" style={{ paddingVertical: 32 }} testID="board-empty">
        <FlapText text="NO DEPARTURES" size={isPhone ? 13 : 18} />
        <Col gap={4} align="center">
          <BoardText>The board is clear for today.</BoardText>
          <BoardText dim size={12}>
            Book the first parcel and it will appear here, grouped by destination.
          </BoardText>
        </Col>
        {canCreate ? (
          <Button title="New booking" icon={Plus} onPress={onNewBooking} testID="board-new-booking" />
        ) : null}
      </Col>
    );
  } else {
    body = (
      <Col gap={0}>
        <Row gap={10} style={{ paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: t.c.boardCell }}>
          <View style={{ width: codeWidth * (flapSize * 0.78 + 2) }}>
            <BoardText dim size={11}>
              DEST
            </BoardText>
          </View>
          {headCell("BKG", 1, "right")}
          {headCell("PKGS", 1, "right")}
          {isPhone ? null : headCell("WT KG", 1.2, "right")}
          {isPhone ? null : headCell("REMARKS", 2)}
        </Row>
        {groups.map((g) => (
          <Pressable
            key={g.station}
            testID={`board-row-${g.station}`}
            accessibilityRole="button"
            accessibilityLabel={`${g.station}: ${g.count} bookings, ${g.packages} packages`}
            onPress={() => onStation(g.station)}
            style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => ({
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: t.c.boardCell,
              backgroundColor: hovered || pressed ? t.c.boardCell : "transparent",
              borderRadius: 4,
              paddingHorizontal: 4,
              marginHorizontal: -4,
            })}
          >
            <Row gap={10}>
              <FlapText text={g.station} width={codeWidth} size={flapSize} />
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <BoardText size={isPhone ? 14 : 16}>{g.count}</BoardText>
              </View>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <BoardText size={isPhone ? 14 : 16}>{g.packages}</BoardText>
              </View>
              {isPhone ? null : (
                <View style={{ flex: 1.2, alignItems: "flex-end" }}>
                  <BoardText size={16}>{formatNumber(Math.round(g.weight))}</BoardText>
                </View>
              )}
              {isPhone ? null : (
                <Col gap={5} style={{ flex: 2 }}>
                  <BoardText size={13}>{remarkFor(g)}</BoardText>
                  <StatusMix g={g} />
                </Col>
              )}
            </Row>
            {isPhone ? (
              <Row gap={10} style={{ marginTop: 8 }}>
                <BoardText dim size={11}>
                  {remarkFor(g)}
                </BoardText>
                <View style={{ flex: 1 }}>
                  <StatusMix g={g} />
                </View>
              </Row>
            ) : null}
          </Pressable>
        ))}
        <Row justify="space-between" wrap gap={8} style={{ paddingTop: 12 }}>
          <BoardText dim size={12}>
            {`${groups.length} STN · ${totals.count} BKG · ${totals.packages} PKGS · ${formatNumber(Math.round(totals.weight))} KG`}
          </BoardText>
          {truncated ? (
            <BoardText dim size={12}>
              SHOWING FIRST 500
            </BoardText>
          ) : null}
        </Row>
      </Col>
    );
  }

  return (
    <Board title={title} right={right} testID="departure-board">
      {body}
      {!error && groups.length > 0 ? (
        <Text variant="caption" style={{ color: t.c.boardDim }}>
          Tap a destination to see its bookings.
        </Text>
      ) : null}
    </Board>
  );
}
