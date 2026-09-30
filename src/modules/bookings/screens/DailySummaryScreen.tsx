/** Daily summary — GET /consignments/daily-summary/:date grouped by payment mode and destination. */
import React, { useState } from "react";
import { View } from "react-native";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  PackagePlus,
} from "lucide-react-native";
import {
  Button,
  Col,
  DataList,
  DateField,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingBlock,
  Money,
  Row,
  Screen,
  SectionHeader,
  StatTile,
  StatusPill,
  Text,
  type Column,
} from "@shared/ui";
import { useLayout, useTheme } from "@shared/useTheme";
import { useApiGet } from "@shared/api/query";
import { apiErrorMessage } from "@shared/api/apiClient";
import { addDays, formatDate, formatNumber, isoDay } from "@shared/lib/format";
import { useAppNav, useParams } from "@navigation/useAppNav";
import { SummaryTable } from "../components/SummaryTable";
import {
  DELIVERY_LABEL,
  PAYMENT_MODES,
  PAYMENT_MODE_LABEL,
  partyName,
  type Consignment,
  type DailySummary,
  type PaymentMode,
} from "../lib/types";

function shift(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number);
  return isoDay(addDays(new Date(y, (m || 1) - 1, d || 1), n));
}

export function DailySummaryScreen() {
  const t = useTheme();
  const { isPhone } = useLayout();
  const nav = useAppNav();
  const params = useParams<{ date: string }>();
  const [date, setDate] = useState<string>(
    params.date ? String(params.date) : isoDay(),
  );
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const q = useApiGet<DailySummary>(
    ["consignments", "daily-summary", date],
    valid ? `/consignments/daily-summary/${date}` : null,
  );
  const s = q.data?.summary;
  const mono = { fontFamily: t.fonts.mono };

  const modeRows = s
    ? Object.entries(s.byPaymentMode)
        .sort(
          ([a], [b]) =>
            PAYMENT_MODES.indexOf(a as PaymentMode) -
            PAYMENT_MODES.indexOf(b as PaymentMode),
        )
        .map(([mode, v]) => ({
          key: mode,
          cells: {
            mode: PAYMENT_MODE_LABEL[mode as PaymentMode] ?? mode,
            count: v.count,
            packages: v.packages,
            amount: <Money value={v.amount} />,
          },
        }))
    : [];
  const stationRows = s
    ? Object.entries(s.byStation)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([st, v]) => ({
          key: st,
          cells: {
            station: st,
            count: v.count,
            packages: v.packages,
            weight: formatNumber(v.weight),
            amount: <Money value={v.amount} />,
          },
        }))
    : [];

  const listCols: Column<Consignment>[] = [
    {
      key: "party",
      title: "Party",
      flex: 1.6,
      render: (c) => <Text numberOfLines={1}>{partyName(c)}</Text>,
    },
    {
      key: "to",
      title: "To",
      flex: 0.7,
      render: (c) => <Text style={mono}>{c.destinationStation}</Text>,
    },
    {
      key: "load",
      title: "Pkgs / Wt",
      flex: 1,
      render: (c) => (
        <Text style={mono} tone="muted">
          {c.packages} · {formatNumber(c.chargeableWeight)} kg
        </Text>
      ),
    },
    {
      key: "mode",
      title: "Mode",
      flex: 0.8,
      render: (c) => <Text>{PAYMENT_MODE_LABEL[c.paymentMode]}</Text>,
    },
    {
      key: "status",
      title: "Delivery",
      flex: 1,
      render: (c) => (
        <StatusPill
          status={c.deliveryStatus}
          label={DELIVERY_LABEL[c.deliveryStatus]}
        />
      ),
    },
    {
      key: "amt",
      title: "Total",
      flex: 1,
      align: "right",
      render: (c) => <Money value={c.totalAmount} />,
    },
  ];

  return (
    <Screen
      title="Daily summary"
      subtitle={valid ? formatDate(date) : undefined}
      back
      backTo="Bookings"
      testID="daily-summary-screen"
      refreshing={q.isRefetching}
      onRefresh={q.refetch}
      actions={
        <Button
          title="Loading list"
          variant="secondary"
          icon={ClipboardList}
          size={isPhone ? "sm" : "md"}
          onPress={() => nav.navigate("LoadingList", { date })}
          testID="daily-summary-loading-list"
        />
      }
    >
      <Col gap={16}>
        <Row gap={8} align="flex-end" wrap>
          <IconButton
            icon={ChevronLeft}
            label="Previous day"
            testID="daily-summary-prev"
            onPress={() => valid && setDate(shift(date, -1))}
          />
          <View style={{ minWidth: 200 }}>
            <DateField
              testID="daily-summary-date"
              label="Date"
              value={date}
              onChange={setDate}
            />
          </View>
          <IconButton
            icon={ChevronRight}
            label="Next day"
            testID="daily-summary-next"
            onPress={() => valid && setDate(shift(date, 1))}
          />
        </Row>

        {!valid ? (
          <Text tone="danger">Enter a date as YYYY-MM-DD</Text>
        ) : q.isLoading ? (
          <LoadingBlock rows={6} />
        ) : q.error ? (
          <ErrorState message={apiErrorMessage(q.error)} onRetry={q.refetch} />
        ) : !s || s.totalConsignments === 0 ? (
          <EmptyState
            title={`No bookings on ${formatDate(date)}`}
            message="Pick another day, or add a booking for this date."
            action={
              <Button
                title="New booking"
                icon={PackagePlus}
                onPress={() => nav.navigate("BookingNew")}
                testID="daily-summary-new"
              />
            }
          />
        ) : (
          <>
            <Row gap={12} wrap testID="daily-summary-totals">
              <StatTile
                label="Bookings"
                value={s.totalConsignments}
                testID="daily-summary-count"
              />
              <StatTile
                label="Packages"
                value={s.grandPackages}
                testID="daily-summary-packages"
              />
              <StatTile
                label="Weight (kg)"
                value={formatNumber(s.grandWeight)}
                testID="daily-summary-weight"
              />
              <StatTile
                label="Total"
                value={<Money value={s.grandTotalAmount} variant="h1" />}
                testID="daily-summary-amount"
              />
            </Row>

            <View
              style={{
                flexDirection: isPhone ? "column" : "row",
                gap: 16,
                alignItems: "flex-start",
              }}
            >
              <Col
                gap={0}
                style={{ flex: isPhone ? undefined : 1, alignSelf: "stretch" }}
              >
                <SectionHeader title="By payment mode" />
                <SummaryTable
                  testID="daily-summary-by-mode"
                  cols={[
                    { key: "mode", title: "Mode", flex: 1.3 },
                    {
                      key: "count",
                      title: "Bookings",
                      align: "right",
                      mono: true,
                    },
                    {
                      key: "packages",
                      title: "Pkgs",
                      align: "right",
                      mono: true,
                    },
                    {
                      key: "amount",
                      title: "Amount",
                      align: "right",
                      flex: 1.4,
                    },
                  ]}
                  rows={modeRows}
                  totals={{
                    mode: "Total",
                    count: s.totalConsignments,
                    packages: s.grandPackages,
                    amount: (
                      <Money
                        value={s.grandTotalAmount}
                        style={{ fontWeight: "700" }}
                      />
                    ),
                  }}
                />
              </Col>
              <Col
                gap={0}
                style={{
                  flex: isPhone ? undefined : 1.3,
                  alignSelf: "stretch",
                }}
              >
                <SectionHeader title="By destination" />
                <SummaryTable
                  testID="daily-summary-by-station"
                  cols={[
                    { key: "station", title: "Station", mono: true },
                    {
                      key: "count",
                      title: "Bookings",
                      align: "right",
                      mono: true,
                    },
                    {
                      key: "packages",
                      title: "Pkgs",
                      align: "right",
                      mono: true,
                    },
                    { key: "weight", title: "Kg", align: "right", mono: true },
                    {
                      key: "amount",
                      title: "Amount",
                      align: "right",
                      flex: 1.4,
                    },
                  ]}
                  rows={stationRows}
                  totals={{
                    station: "Total",
                    count: s.totalConsignments,
                    packages: s.grandPackages,
                    weight: formatNumber(s.grandWeight),
                    amount: (
                      <Money
                        value={s.grandTotalAmount}
                        style={{ fontWeight: "700" }}
                      />
                    ),
                  }}
                />
              </Col>
            </View>

            <SectionHeader title="Bookings" />
            <DataList<Consignment>
              testID="daily-summary-list"
              rows={q.data?.consignments}
              columns={listCols}
              keyOf={(c) => c.id}
              onRowPress={(c) => nav.navigate("BookingDetail", { id: c.id })}
              phoneRight={(c) => <Money value={c.totalAmount} />}
            />
          </>
        )}
      </Col>
    </Screen>
  );
}
