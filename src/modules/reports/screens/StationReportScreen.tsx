/** Station-wise revenue — GET /reports/station?startDate&endDate. */
import React, { useState } from "react";
import { View } from "react-native";
import { MapPin } from "lucide-react-native";
import { Col, DataList, EmptyState, ErrorState, Money, Row, Screen, Text, type Column } from "@shared/ui";
import { useTheme } from "@shared/useTheme";
import { useApiGet } from "@shared/api/query";
import { apiErrorMessage } from "@shared/api/apiClient";
import { formatDate, formatNumber } from "@shared/lib/format";
import { useAppNav } from "@navigation/useAppNav";
import { DateRangeBar, ExportButton, Figure, FigureRow, MonoNum, rangeError } from "../components/ReportControls";
import { presetRange, sum, type DateRange, type StationReportRow } from "../types";

function StationCode({ code }: { code: string }) {
  const t = useTheme();
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: t.radius.sm, backgroundColor: t.c.surfaceAlt }}>
      <Text style={{ fontFamily: t.fonts.monoBold, fontSize: 14 }}>{code}</Text>
    </View>
  );
}

export function StationReportScreen() {
  const t = useTheme();
  const nav = useAppNav();
  const [range, setRange] = useState<DateRange>(() => presetRange("month"));
  const valid = !rangeError(range);
  const q = useApiGet<StationReportRow[]>(["reports", "station"], valid ? "/reports/station" : null, { ...range });
  const rows = q.data;
  const loading = q.isLoading && valid;
  const total = sum(rows, (r) => r.totalAmount);
  const top = rows?.[0];

  const share = (r: StationReportRow) => (total > 0 ? r.totalAmount / total : 0);

  const columns: Column<StationReportRow>[] = [
    { key: "st", title: "Station", flex: 1, render: (r) => <StationCode code={(r.station || "—").toUpperCase()} /> },
    { key: "cnt", title: "Bookings", align: "right", render: (r) => <MonoNum value={r.consignmentCount} /> },
    { key: "pkg", title: "Packages", align: "right", render: (r) => <MonoNum value={formatNumber(r.totalPackages)} /> },
    { key: "wt", title: "Wt (kg)", align: "right", hideOnPhone: true, render: (r) => <MonoNum value={formatNumber(r.totalChargeableWeight)} /> },
    { key: "fr", title: "Freight", align: "right", flex: 1.2, hideOnPhone: true, render: (r) => <Money value={r.totalFreight} /> },
    { key: "tot", title: "Total", align: "right", flex: 1.2, render: (r) => <Money value={r.totalAmount} style={{ fontFamily: t.fonts.monoBold }} /> },
    {
      key: "share",
      title: "Share",
      flex: 1.4,
      render: (r) => (
        <Row gap={8} style={{ alignSelf: "stretch" }}>
          <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: t.c.surfaceAlt, overflow: "hidden" }}>
            <View style={{ width: `${share(r) * 100}%`, height: "100%", backgroundColor: t.c.accent }} />
          </View>
          <Text variant="caption" tone="muted" style={{ minWidth: 36, textAlign: "right" }}>
            {Math.round(share(r) * 100)}%
          </Text>
        </Row>
      ),
    },
  ];

  return (
    <Screen
      title="Station-wise revenue"
      subtitle={`${formatDate(range.startDate)} – ${formatDate(range.endDate)}`}
      back
      backTo="Reports"
      testID="report-station"
      actions={<ExportButton url="/reports/station/export" filename={`station-report-${range.startDate}-to-${range.endDate}.xlsx`} params={{ ...range }} disabled={!valid} />}
    >
      <Col gap={16}>
        <DateRangeBar value={range} onChange={setRange} />
        {q.error ? (
          <ErrorState message={apiErrorMessage(q.error)} onRetry={() => q.refetch()} />
        ) : (
          <>
            <FigureRow>
              <Figure label="Stations served" loading={loading}>
                <MonoNum strong value={rows?.length ?? 0} />
              </Figure>
              <Figure label="Bookings" loading={loading} hint={`${formatNumber(sum(rows, (r) => r.totalPackages))} packages`}>
                <MonoNum strong value={formatNumber(sum(rows, (r) => r.consignmentCount))} />
              </Figure>
              <Figure label="Total revenue" loading={loading}>
                <Money value={total} variant="h2" />
              </Figure>
              <Figure
                label="Top station"
                loading={loading}
                hint={top ? `${Math.round(share(top) * 100)}% of revenue` : undefined}
              >
                <MonoNum strong value={top ? (top.station || "—").toUpperCase() : "—"} />
              </Figure>
            </FigureRow>
            <DataList
              testID="station-list"
              rows={valid ? rows : []}
              loading={loading}
              columns={columns}
              keyOf={(r) => r.station || "none"}
              onRowPress={(r) =>
                r.station &&
                nav.navigate("Bookings", { destinationStation: r.station, startDate: range.startDate, endDate: range.endDate })
              }
              phoneTitle={(r) => <StationCode code={(r.station || "—").toUpperCase()} />}
              phoneRight={(r) => <Money value={r.totalAmount} />}
              empty={
                <EmptyState
                  icon={MapPin}
                  title="No bookings in this range"
                  message={valid ? "Try a wider date range." : "Fix the dates above to run the report."}
                />
              }
            />
          </>
        )}
      </Col>
    </Screen>
  );
}
