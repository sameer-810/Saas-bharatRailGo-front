/**
 * Home — the "Departure board". Today at a glance for a parcel booking agent:
 * money in and out, today's bookings as a station board, trend and insights.
 */
import React, { useCallback } from "react";
import { View } from "react-native";
import { FilePlus, IndianRupee, Plus } from "lucide-react-native";
import { Banner, Button, Col, ErrorState, Row, Screen, Text } from "@shared/ui";
import { useLayout } from "@shared/useTheme";
import { useApiGet, useApiList } from "@shared/api/query";
import { useBranches } from "@shared/api/lookups";
import { useReadOnly } from "@shared/lib/permissions";
import { addDays, formatNumber, isoDay } from "@shared/lib/format";
import { useAuthStore } from "@shared/store/useAuthStore";
import { useBranchStore } from "@shared/store/useBranchStore";
import { useAppNav } from "@navigation/useAppNav";
import { apiErrorMessage } from "@shared/api/apiClient";
import { DepartureBoard } from "../components/DepartureBoard";
import { MoneyStrip, type MoneyTileSpec } from "../components/MoneyStrip";
import { TrendCard } from "../components/TrendCard";
import {
  ModeMix,
  PendingByTrain,
  RecentBookings,
  TopStations,
} from "../components/Insights";
import type {
  BoardConsignment,
  DailyRow,
  DashboardMetrics,
  PaymentLite,
} from "../types";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function greeting(d: Date) {
  const h = d.getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function HomeScreen() {
  const nav = useAppNav();
  const { isDesktop, isPhone } = useLayout();
  const readOnly = useReadOnly();
  const userName = useAuthStore((s) => s.user?.name);
  const branchId = useBranchStore((s) => s.branchId);
  const branches = useBranches();

  const now = new Date();
  const today = isoDay(now);
  const from14 = isoDay(addDays(now, -13));

  const metrics = useApiGet<DashboardMetrics>(["dashboard"], "/dashboard");
  const board = useApiList<BoardConsignment>("dashboard", "/consignments", {
    startDate: today,
    endDate: today,
    limit: 500,
  });
  const collections = useApiList<PaymentLite>("dashboard", "/payments", {
    startDate: today,
    endDate: today,
    limit: 500,
  });
  const daily = useApiGet<DailyRow[]>(
    ["dashboard", "daily14"],
    "/reports/daily",
    {
      startDate: from14,
      endDate: today,
    },
  );

  const refresh = useCallback(() => {
    metrics.refetch();
    board.refetch();
    collections.refetch();
    daily.refetch();
  }, [metrics, board, collections, daily]);

  const m = metrics.data;
  const branch =
    branchId !== "all"
      ? branches.data?.find((b) => b.id === branchId)
      : undefined;
  const collected = (collections.data?.items || []).reduce(
    (s, p) => s + (p.amount || 0),
    0,
  );
  const receipts =
    collections.data?.meta.total ?? collections.data?.items.length ?? 0;

  const tiles: MoneyTileSpec[] = [
    {
      key: "booked-today",
      label: "Booked today",
      amount: m?.today.totalRevenue ?? 0,
      hint: m
        ? `${m.today.consignmentCount} bookings · ${formatNumber(m.today.totalPackages)} pkgs`
        : undefined,
      onPress: () => nav.navigate("ReportDaily"),
    },
    {
      key: "collected-today",
      label: "Collected today",
      amount: collections.error ? undefined : collected,
      count: collections.error ? 0 : undefined,
      hint: collections.error
        ? "Could not load payments"
        : `${receipts} ${receipts === 1 ? "receipt" : "receipts"}`,
      onPress: () => nav.navigate("Payments"),
    },
    {
      key: "outstanding",
      label: "To pay + on bill due",
      amount: m?.outstanding.totalAmount ?? 0,
      tone: (m?.outstanding.totalAmount ?? 0) > 0 ? "warning" : "default",
      hint: m ? `${m.outstanding.consignmentCount} unpaid bilties` : undefined,
      onPress: () => nav.navigate("ReportOutstanding"),
    },
    {
      key: "open-work",
      label: "Pending delivery",
      count: m?.pendingPods ?? 0,
      hint: m ? `${m.activeInvoices} open bills` : undefined,
    },
  ];

  const header = (
    <Row
      justify="space-between"
      align="flex-end"
      wrap
      gap={16}
      style={{ marginBottom: 20 }}
    >
      <Col gap={4} style={{ flexShrink: 1 }}>
        <Text variant="overline" tone="accent" testID="home-date">
          {`${WEEKDAYS[now.getDay()]} · ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`}
        </Text>
        <Text
          variant={isPhone ? "h1" : "display"}
          accessibilityRole="header"
          testID="screen-title"
        >
          {greeting(now)}
          {userName ? `, ${userName.split(" ")[0]}` : ""}
        </Text>
        <Text tone="muted">
          {branch ? `${branch.name} branch` : "All branches"} · here is how the
          day is moving.
        </Text>
      </Col>
      <Row gap={8} wrap>
        <Button
          title="New booking"
          icon={Plus}
          onPress={() => nav.navigate("BookingNew")}
          disabled={readOnly}
          testID="home-new-booking"
        />
        <Button
          title="New bilti"
          icon={FilePlus}
          variant="secondary"
          onPress={() => nav.navigate("BiltiNew")}
          disabled={readOnly}
          testID="home-new-bilti"
        />
        <Button
          title="Record payment"
          icon={IndianRupee}
          variant="secondary"
          onPress={() => nav.navigate("PaymentNew")}
          disabled={readOnly}
          testID="home-record-payment"
        />
      </Row>
    </Row>
  );

  const boardRows = board.data?.items;
  const departure = (
    <DepartureBoard
      rows={boardRows}
      loading={board.isLoading}
      error={board.error}
      onRetry={() => board.refetch()}
      truncated={(board.data?.meta.total ?? 0) > (boardRows?.length ?? 0)}
      stationOrigin={branch?.stationCode}
      onStation={(code) =>
        nav.navigate("Bookings", {
          destinationStation: code,
          startDate: today,
          endDate: today,
        })
      }
      onNewBooking={() => nav.navigate("BookingNew")}
      canCreate={!readOnly}
    />
  );

  const trend = (
    <TrendCard
      daily={daily.data}
      dailyLoading={daily.isLoading}
      monthly={m?.monthlyTrend}
    />
  );
  const recent = (
    <RecentBookings
      rows={m?.recentConsignments}
      loading={metrics.isLoading}
      onOpen={(id) => nav.navigate("BookingDetail", { id })}
      onAll={() => nav.navigate("Bookings")}
      onNew={() => nav.navigate("BookingNew")}
      canCreate={!readOnly}
    />
  );
  const stations = (
    <TopStations
      rows={m?.topStations}
      loading={metrics.isLoading}
      onStation={(code) =>
        nav.navigate("Bookings", { destinationStation: code })
      }
    />
  );
  const trains = (
    <PendingByTrain
      rows={m?.pendingByTrain}
      loading={metrics.isLoading}
      onParty={(id) => nav.navigate("PartyDetail", { id })}
    />
  );
  const mix = <ModeMix rows={m?.paymentModeMix} loading={metrics.isLoading} />;

  const metricsError = metrics.error ? (
    <ErrorState
      message={apiErrorMessage(metrics.error)}
      onRetry={() => metrics.refetch()}
    />
  ) : null;

  return (
    <Screen
      testID="home-screen"
      refreshing={metrics.isRefetching || board.isRefetching}
      onRefresh={refresh}
      maxWidth={1320}
    >
      {header}
      {readOnly ? (
        <View style={{ marginBottom: 16 }}>
          <Banner
            tone="warning"
            title="Read-only mode"
            message="Your subscription has expired. You can view everything, but new bookings and payments are paused until you renew."
            testID="home-readonly"
          />
        </View>
      ) : null}

      {metrics.error ? null : (
        <MoneyStrip tiles={tiles} loading={metrics.isLoading} />
      )}

      <View style={{ height: 20 }} />

      {isDesktop ? (
        <Row gap={20} align="flex-start">
          <Col gap={20} style={{ flex: 3, minWidth: 0 }}>
            {departure}
            {metricsError ?? recent}
          </Col>
          <Col gap={20} style={{ flex: 2, minWidth: 0 }}>
            {trend}
            {metricsError ? null : (
              <>
                {stations}
                {trains}
                {mix}
              </>
            )}
          </Col>
        </Row>
      ) : (
        <Col gap={16}>
          {departure}
          {trend}
          {metricsError ?? (
            <>
              {recent}
              {stations}
              {trains}
              {mix}
            </>
          )}
        </Col>
      )}
    </Screen>
  );
}
