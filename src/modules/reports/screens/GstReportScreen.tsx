/** Monthly GST summary — GET /reports/gst?month&year (bills, excluding cancelled). */
import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { ReceiptIndianRupee } from "lucide-react-native";
import {
  Card,
  Chip,
  Col,
  DataList,
  EmptyState,
  ErrorState,
  Money,
  Row,
  Screen,
  Select,
  StatusPill,
  Text,
  type Column,
} from "@shared/ui";
import { useTheme } from "@shared/useTheme";
import { useApiGet } from "@shared/api/query";
import { apiErrorMessage } from "@shared/api/apiClient";
import { formatDate, formatMoney } from "@shared/lib/format";
import { ExportButton, Figure, FigureRow } from "../components/ReportControls";
import { sum, type GstRow } from "../types";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function rate(r: number | undefined) {
  return r ? `${r}%` : "";
}

export function GstReportScreen() {
  const t = useTheme();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const params = { month, year };
  const q = useApiGet<GstRow[]>(["reports", "gst"], "/reports/gst", params);
  const rows = q.data;
  const loading = q.isLoading;

  const years = useMemo(() => {
    const y = now.getFullYear();
    return Array.from({ length: 6 }, (_, i) => ({ value: y - i, label: String(y - i) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const isThis = month === now.getMonth() + 1 && year === now.getFullYear();
  const isLast = month === lastMonth.getMonth() + 1 && year === lastMonth.getFullYear();

  const totals = {
    service: sum(rows, (r) => r.serviceSubtotal),
    reimb: sum(rows, (r) => r.reimbursementSubtotal),
    cgst: sum(rows, (r) => r.cgstAmount),
    sgst: sum(rows, (r) => r.sgstAmount),
    igst: sum(rows, (r) => r.igstAmount),
    gross: sum(rows, (r) => r.grossTotal),
  };
  const totalTax = Math.round((totals.cgst + totals.sgst + totals.igst) * 100) / 100;

  const columns: Column<GstRow>[] = [
    {
      key: "bill",
      title: "Bill",
      flex: 1.2,
      render: (r) => (
        <Col gap={1}>
          <Text style={{ fontFamily: t.fonts.monoBold }}>{r.billNumber}</Text>
          <Text variant="caption" tone="faint">
            {formatDate(r.date)}
          </Text>
        </Col>
      ),
    },
    {
      key: "party",
      title: "Party / GSTIN",
      flex: 2,
      render: (r) => (
        <Col gap={1}>
          <Text numberOfLines={1}>{r.partyName || "—"}</Text>
          <Text variant="caption" tone="faint" style={{ fontFamily: t.fonts.mono }} numberOfLines={1}>
            {r.gstin || "Unregistered"}
          </Text>
        </Col>
      ),
    },
    { key: "svc", title: "Taxable", align: "right", flex: 1.2, render: (r) => <Money value={r.serviceSubtotal} /> },
    {
      key: "cgst",
      title: "CGST",
      align: "right",
      flex: 1.1,
      hideOnPhone: true,
      render: (r) => (
        <Col gap={0} align="flex-end">
          <Money value={r.cgstAmount} />
          <Text variant="caption" tone="faint">{rate(r.cgstRate)}</Text>
        </Col>
      ),
    },
    {
      key: "sgst",
      title: "SGST",
      align: "right",
      flex: 1.1,
      hideOnPhone: true,
      render: (r) => (
        <Col gap={0} align="flex-end">
          <Money value={r.sgstAmount} />
          <Text variant="caption" tone="faint">{rate(r.sgstRate)}</Text>
        </Col>
      ),
    },
    {
      key: "igst",
      title: "IGST",
      align: "right",
      flex: 1.1,
      hideOnPhone: true,
      render: (r) => (
        <Col gap={0} align="flex-end">
          <Money value={r.igstAmount} />
          <Text variant="caption" tone="faint">{rate(r.igstRate)}</Text>
        </Col>
      ),
    },
    { key: "reimb", title: "Reimb.", align: "right", flex: 1.1, hideOnPhone: true, render: (r) => <Money value={r.reimbursementSubtotal} /> },
    { key: "gross", title: "Gross", align: "right", flex: 1.2, render: (r) => <Money value={r.grossTotal} style={{ fontFamily: t.fonts.monoBold }} /> },
    { key: "status", title: "Status", flex: 0.9, render: (r) => <StatusPill status={r.status} /> },
  ];

  return (
    <Screen
      title="Monthly GST"
      subtitle={`${MONTHS[month - 1]} ${year} · bills excluding cancelled`}
      back
      backTo="Reports"
      testID="report-gst"
      actions={<ExportButton url="/reports/gst/export" filename={`gst-report-${year}-${String(month).padStart(2, "0")}.xlsx`} params={params} />}
    >
      <Col gap={16}>
        <Card testID="report-filters" padding={14}>
          <Col gap={12}>
            <Row gap={8} wrap>
              <Chip
                label="This month"
                selected={isThis}
                testID="range-month"
                onPress={() => {
                  setMonth(now.getMonth() + 1);
                  setYear(now.getFullYear());
                }}
              />
              <Chip
                label="Last month"
                selected={isLast}
                testID="range-lastMonth"
                onPress={() => {
                  setMonth(lastMonth.getMonth() + 1);
                  setYear(lastMonth.getFullYear());
                }}
              />
            </Row>
            <Row gap={12} align="flex-start">
              <View style={{ flex: 2 }}>
                <Select<number>
                  label="Month"
                  value={month}
                  options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
                  onChange={(v) => v && setMonth(v)}
                  searchable={false}
                  testID="gst-month"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Select<number> label="Year" value={year} options={years} onChange={(v) => v && setYear(v)} testID="gst-year" />
              </View>
            </Row>
          </Col>
        </Card>

        {q.error ? (
          <ErrorState message={apiErrorMessage(q.error)} onRetry={() => q.refetch()} />
        ) : (
          <>
            <FigureRow>
              <Figure label="Taxable value" loading={loading} hint={rows ? `${rows.length} bills` : undefined}>
                <Money value={totals.service} variant="h2" />
              </Figure>
              <Figure label="CGST" loading={loading}>
                <Money value={totals.cgst} variant="h2" />
              </Figure>
              <Figure label="SGST" loading={loading}>
                <Money value={totals.sgst} variant="h2" />
              </Figure>
              <Figure label="IGST" loading={loading}>
                <Money value={totals.igst} variant="h2" />
              </Figure>
              <Figure label="Total tax" loading={loading} hint={`Reimbursements ${formatMoney(totals.reimb)}`}>
                <Money value={totalTax} variant="h2" tone="accent" />
              </Figure>
              <Figure label="Gross billed" loading={loading}>
                <Money value={totals.gross} variant="h2" />
              </Figure>
            </FigureRow>
            <DataList
              testID="gst-list"
              rows={rows}
              loading={loading}
              columns={columns}
              keyOf={(r) => `${r.billNumber}-${r.date}`}
              phoneTitle={(r) => (
                <Col gap={1}>
                  <Text style={{ fontFamily: t.fonts.monoBold }}>{r.billNumber}</Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {r.partyName || "—"} · {formatDate(r.date)}
                  </Text>
                </Col>
              )}
              phoneRight={(r) => <Money value={r.grossTotal} />}
              empty={
                <EmptyState
                  icon={ReceiptIndianRupee}
                  title={`No bills in ${MONTHS[month - 1]} ${year}`}
                  message="GST is worked out from bills (invoices). Pick another month, or raise bills for this month's parcels."
                />
              }
            />
          </>
        )}
      </Col>
    </Screen>
  );
}

