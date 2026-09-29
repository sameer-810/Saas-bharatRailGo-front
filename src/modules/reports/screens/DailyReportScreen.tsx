/** Daily bookings report — GET /reports/daily?startDate&endDate. */
import React, { useState } from "react";
import { View } from "react-native";
import { CalendarDays } from "lucide-react-native";
import { Card, Col, DataList, EmptyState, ErrorState, Money, Row, Screen, SectionHeader, Text, type Column } from "@shared/ui";
import { useTheme } from "@shared/useTheme";
import { useApiGet } from "@shared/api/query";
import { apiErrorMessage } from "@shared/api/apiClient";
import { formatDate, formatNumber } from "@shared/lib/format";
import { DateRangeBar, ExportButton, Figure, FigureRow, MonoNum, rangeError } from "../components/ReportControls";
import { presetRange, sum, type DailyReportRow, type DateRange } from "../types";

export function DailyReportScreen() {
  const t = useTheme();
  const [range, setRange] = useState<DateRange>(() => presetRange("month"));
  const valid = !rangeError(range);
  const q = useApiGet<DailyReportRow[]>(["reports", "daily"], valid ? "/reports/daily" : null, { ...range });
  const rows = q.data;
  const loading = q.isLoading && valid;

  const total = sum(rows, (r) => r.totalAmount);
  const max = Math.max(1, ...(rows || []).map((r) => r.totalAmount));

  const columns: Column<DailyReportRow>[] = [
    { key: "date", title: "Date", flex: 1.3, render: (r) => <Text variant="bodyStrong">{formatDate(r.date)}</Text> },
    { key: "cnt", title: "Bookings", align: "right", render: (r) => <MonoNum value={r.consignmentCount} /> },
    { key: "pkg", title: "Packages", align: "right", render: (r) => <MonoNum value={formatNumber(r.totalPackages)} /> },
    { key: "wt", title: "Wt (kg)", align: "right", render: (r) => <MonoNum value={formatNumber(r.totalChargeableWeight)} /> },
    { key: "fr", title: "Freight", align: "right", flex: 1.2, hideOnPhone: true, render: (r) => <Money value={r.totalFreight} /> },
    { key: "re", title: "Reimb.", align: "right", flex: 1.2, hideOnPhone: true, render: (r) => <Money value={r.totalReimbursement} /> },
    { key: "ha", title: "Hamali", align: "right", flex: 1.1, hideOnPhone: true, render: (r) => <Money value={r.totalHamali} /> },
    { key: "ot", title: "Other", align: "right", flex: 1.1, hideOnPhone: true, render: (r) => <Money value={r.totalOther} /> },
    { key: "tot", title: "Total", align: "right", flex: 1.3, render: (r) => <Money value={r.totalAmount} style={{ fontFamily: t.fonts.monoBold }} /> },
  ];

  return (
    <Screen
      title="Daily bookings"
      subtitle={`${formatDate(range.startDate)} – ${formatDate(range.endDate)}`}
      back
      backTo="Reports"
      testID="report-daily"
      actions={<ExportButton url="/reports/daily/export" filename={`daily-report-${range.startDate}-to-${range.endDate}.xlsx`} params={{ ...range }} disabled={!valid} />}
    >
      <Col gap={16}>
        <DateRangeBar value={range} onChange={setRange} />
        {q.error ? (
          <ErrorState message={apiErrorMessage(q.error)} onRetry={() => q.refetch()} />
        ) : (
          <>
            <FigureRow>
              <Figure label="Bookings" loading={loading} hint={rows ? `${rows.length} active days` : undefined}>
                <MonoNum strong value={formatNumber(sum(rows, (r) => r.consignmentCount))} />
              </Figure>
              <Figure label="Packages" loading={loading}>
                <MonoNum strong value={formatNumber(sum(rows, (r) => r.totalPackages))} />
              </Figure>
              <Figure label="Chargeable wt" loading={loading} hint="kilograms">
                <MonoNum strong value={formatNumber(sum(rows, (r) => r.totalChargeableWeight))} />
              </Figure>
              <Figure label="Freight" loading={loading}>
                <Money value={sum(rows, (r) => r.totalFreight)} variant="h2" />
              </Figure>
              <Figure label="Total billed" loading={loading} hint="freight + reimb. + hamali + other">
                <Money value={total} variant="h2" />
              </Figure>
            </FigureRow>

            {rows && rows.length > 1 ? (
              <Card testID="daily-chart">
                <SectionHeader title="Total per day" />
                <Row gap={3} align="flex-end" style={{ height: 110 }}>
                  {rows.map((r) => (
                    <View
                      key={r.date}
                      accessibilityLabel={`${formatDate(r.date)}: ${r.totalAmount}`}
                      style={{
                        flex: 1,
                        maxWidth: 40,
                        height: Math.max(3, (r.totalAmount / max) * 100),
                        backgroundColor: t.c.accent,
                        borderTopLeftRadius: 3,
                        borderTopRightRadius: 3,
                      }}
                    />
                  ))}
                </Row>
                <Row justify="space-between" style={{ marginTop: 6 }}>
                  <Text variant="caption" tone="faint">
                    {formatDate(rows[0].date)}
                  </Text>
                  <Text variant="caption" tone="faint">
                    {formatDate(rows[rows.length - 1].date)}
                  </Text>
                </Row>
              </Card>
            ) : null}

            <DataList
              testID="daily-list"
              rows={valid ? rows : []}
              loading={loading}
              columns={columns}
              keyOf={(r) => r.date}
              phoneTitle={(r) => <Text variant="bodyStrong">{formatDate(r.date)}</Text>}
              phoneRight={(r) => <Money value={r.totalAmount} />}
              empty={
                <EmptyState
                  icon={CalendarDays}
                  title="No bookings in this range"
                  message={valid ? "Try a wider date range, like This month or Last month." : "Fix the dates above to run the report."}
                />
              }
            />
          </>
        )}
      </Col>
    </Screen>
  );
}
