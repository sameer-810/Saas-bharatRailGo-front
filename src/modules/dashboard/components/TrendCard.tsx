/** Bookings / revenue trend as simple bars (Views only, no chart library). */
import React, { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import {
  Card,
  Col,
  Money,
  Row,
  SectionHeader,
  SegmentedControl,
  Skeleton,
  Text,
} from "@shared/ui";
import { useTheme } from "@shared/useTheme";
import { addDays, formatMoney, isoDay } from "@shared/lib/format";
import type { DailyRow, DashboardMetrics } from "../types";

type Range = "14d" | "6m";
type Metric = "revenue" | "bookings";

interface Bar {
  key: string;
  label: string;
  revenue: number;
  bookings: number;
  current: boolean;
}

const DAY = ["S", "M", "T", "W", "T", "F", "S"];

function fillDays(rows: DailyRow[] | undefined, days: number): Bar[] {
  const by = new Map((rows || []).map((r) => [r.date, r]));
  const out: Bar[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const key = isoDay(d);
    const r = by.get(key);
    out.push({
      key,
      label: i === 0 ? "Today" : `${DAY[d.getDay()]}${d.getDate()}`,
      revenue: r?.totalAmount ?? 0,
      bookings: r?.consignmentCount ?? 0,
      current: i === 0,
    });
  }
  return out;
}

export function TrendCard({
  daily,
  dailyLoading,
  monthly,
}: {
  daily: DailyRow[] | undefined;
  dailyLoading: boolean;
  monthly: DashboardMetrics["monthlyTrend"] | undefined;
}) {
  const t = useTheme();
  const [range, setRange] = useState<Range>("14d");
  const [metric, setMetric] = useState<Metric>("revenue");
  const [picked, setPicked] = useState<string | null>(null);

  const bars: Bar[] = useMemo(() => {
    if (range === "14d") return fillDays(daily, 14);
    return (monthly || []).map((m, i, arr) => ({
      key: m.month,
      label: m.label,
      revenue: m.revenue,
      bookings: m.consignments,
      current: i === arr.length - 1,
    }));
  }, [range, daily, monthly]);

  const val = (b: Bar) => (metric === "revenue" ? b.revenue : b.bookings);
  const max = Math.max(1, ...bars.map(val));
  const total = bars.reduce((s, b) => s + val(b), 0);
  const focus =
    bars.find((b) => b.key === picked) ??
    bars.find((b) => b.current) ??
    bars[bars.length - 1];
  const loading = range === "14d" ? dailyLoading && !daily : !monthly;
  const fmt = (n: number) =>
    metric === "revenue" ? formatMoney(n, { compact: true }) : String(n);

  return (
    <Card testID="trend-card">
      <SectionHeader
        title="Trend"
        action={
          <SegmentedControl<Range>
            testID="trend-range"
            value={range}
            onChange={(v) => {
              setRange(v);
              setPicked(null);
            }}
            options={[
              { value: "14d", label: "14 days" },
              { value: "6m", label: "6 months" },
            ]}
          />
        }
      />
      <Row justify="space-between" align="flex-end" wrap gap={8}>
        <Col gap={2}>
          <Text variant="caption" tone="faint">
            {focus
              ? focus.current
                ? range === "14d"
                  ? "Today"
                  : "This month"
                : focus.label
              : "—"}
          </Text>
          {metric === "revenue" ? (
            <Money value={focus ? focus.revenue : 0} variant="h1" />
          ) : (
            <Text variant="h1" style={{ fontFamily: t.fonts.mono }}>
              {focus ? focus.bookings : 0}
              <Text tone="muted"> bookings</Text>
            </Text>
          )}
          <Text variant="caption" tone="muted">
            {range === "14d" ? "14-day" : "6-month"} total {fmt(total)}
          </Text>
        </Col>
        <SegmentedControl<Metric>
          testID="trend-metric"
          value={metric}
          onChange={setMetric}
          options={[
            { value: "revenue", label: "₹ Revenue" },
            { value: "bookings", label: "Bookings" },
          ]}
        />
      </Row>

      <View style={{ marginTop: 16 }}>
        {loading ? (
          <Skeleton height={140} />
        ) : (
          <Row
            gap={range === "14d" ? 4 : 10}
            align="flex-end"
            style={{ height: 150 }}
          >
            {bars.map((b) => {
              const h = Math.max(3, (val(b) / max) * 120);
              const active = focus?.key === b.key;
              return (
                <Pressable
                  key={b.key}
                  testID={`trend-bar-${b.key}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${b.label}: ${fmt(val(b))}`}
                  onPress={() => setPicked(b.key)}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "flex-end",
                    height: "100%",
                    gap: 6,
                  }}
                >
                  <View
                    style={{
                      width: "100%",
                      maxWidth: 36,
                      height: h,
                      borderTopLeftRadius: 4,
                      borderTopRightRadius: 4,
                      backgroundColor: active ? t.c.accent : t.c.accentSoft,
                      borderWidth: active ? 0 : 1,
                      borderColor: b.current ? t.c.accent : t.c.border,
                    }}
                  />
                  <Text
                    variant="caption"
                    tone={active ? "default" : "faint"}
                    numberOfLines={1}
                    style={{ fontSize: range === "14d" ? 9 : 11 }}
                  >
                    {b.label}
                  </Text>
                </Pressable>
              );
            })}
          </Row>
        )}
      </View>
    </Card>
  );
}
