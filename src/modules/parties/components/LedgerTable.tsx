/** Running-balance statement for one party (GET /parties/:id/ledger), with a client-side date window. */
import React, { useMemo, useState } from "react";
import { BookOpen } from "lucide-react-native";
import {
  Button,
  Card,
  Col,
  DataList,
  DateField,
  EmptyState,
  Money,
  Row,
  Text,
  type Column,
} from "@shared/ui";
import { useLayout, useTheme } from "@shared/useTheme";
import { formatDate, isoDay } from "@shared/lib/format";
import { useAppNav } from "@navigation/useAppNav";
import type { LedgerRow } from "../types";

interface Row_ extends LedgerRow {
  key: string;
  day: string;
}

/** ₹1,234.00 Dr / Cr — positive balance means the party owes us. */
export function Balance({
  value,
  variant,
}: {
  value: number;
  variant?: "money" | "h3" | "h2";
}) {
  const t = useTheme();
  return (
    <Row gap={4} align="baseline">
      <Money value={Math.abs(value)} variant={variant} />
      <Text variant="caption" tone="faint" style={{ fontFamily: t.fonts.mono }}>
        {value > 0 ? "Dr" : value < 0 ? "Cr" : ""}
      </Text>
    </Row>
  );
}

export function LedgerTable({
  rows,
  loading,
  error,
  onRetry,
  emptyAction,
}: {
  rows: LedgerRow[] | undefined;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyAction?: React.ReactNode;
}) {
  const t = useTheme();
  const nav = useAppNav();
  const { isPhone } = useLayout();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const view = useMemo(() => {
    const all: Row_[] = (rows || []).map((r, i) => ({
      ...r,
      key: `${r.type}-${r.refId || "x"}-${i}`,
      day: r.date ? isoDay(new Date(r.date)) : "",
    }));
    let broughtForward = 0;
    const inRange: Row_[] = [];
    for (const r of all) {
      if (from && r.day < from) {
        broughtForward = r.balance;
        continue;
      }
      if (to && r.day > to) continue;
      inRange.push(r);
    }
    const debit = inRange.reduce((a, r) => a + (r.debit || 0), 0);
    const credit = inRange.reduce((a, r) => a + (r.credit || 0), 0);
    const closing = inRange.length
      ? inRange[inRange.length - 1].balance
      : broughtForward;
    return { inRange, broughtForward, debit, credit, closing };
  }, [rows, from, to]);

  const filtered = !!(from || to);

  const columns: Column<Row_>[] = [
    {
      key: "date",
      title: "Date",
      flex: 1,
      render: (r) => <Text tone="muted">{formatDate(r.date)}</Text>,
    },
    {
      key: "particulars",
      title: "Particulars",
      flex: 2.6,
      render: (r) => (
        <Col gap={0}>
          <Text
            numberOfLines={2}
            style={
              r.type === "consignment"
                ? { fontFamily: t.fonts.mono }
                : undefined
            }
          >
            {r.type === "consignment"
              ? `Booking · ${r.description}`
              : r.description}
          </Text>
        </Col>
      ),
    },
    {
      key: "debit",
      title: "Debit",
      flex: 1.1,
      align: "right",
      render: (r) =>
        r.debit ? <Money value={r.debit} /> : <Text tone="faint">—</Text>,
    },
    {
      key: "credit",
      title: "Credit",
      flex: 1.1,
      align: "right",
      render: (r) =>
        r.credit ? (
          <Money value={r.credit} tone="success" />
        ) : (
          <Text tone="faint">—</Text>
        ),
    },
    {
      key: "balance",
      title: "Balance",
      flex: 1.3,
      align: "right",
      render: (r) => <Balance value={r.balance} />,
    },
  ];

  return (
    <Col gap={12} testID="party-ledger">
      <Row gap={12} wrap align="flex-end">
        <Col
          style={{ minWidth: 150, flexGrow: isPhone ? 1 : 0, flexBasis: 170 }}
        >
          <DateField
            testID="party-ledger-from"
            label="From"
            value={from}
            onChange={setFrom}
            quick={false}
          />
        </Col>
        <Col
          style={{ minWidth: 150, flexGrow: isPhone ? 1 : 0, flexBasis: 170 }}
        >
          <DateField
            testID="party-ledger-to"
            label="To"
            value={to}
            onChange={setTo}
            quick={false}
          />
        </Col>
        {filtered ? (
          <Button
            testID="party-ledger-clear"
            title="All dates"
            variant="ghost"
            onPress={() => {
              setFrom("");
              setTo("");
            }}
          />
        ) : null}
      </Row>

      {filtered && from ? (
        <Row
          justify="space-between"
          testID="party-ledger-bf"
          style={{ paddingHorizontal: 4 }}
        >
          <Text tone="muted">Brought forward (before {formatDate(from)})</Text>
          <Balance value={view.broughtForward} />
        </Row>
      ) : null}

      <DataList<Row_>
        testID="party-ledger-list"
        rows={rows ? view.inRange : undefined}
        columns={columns}
        keyOf={(r) => r.key}
        loading={loading}
        error={error}
        onRetry={onRetry}
        onRowPress={(r) => {
          if (r.type === "consignment" && r.refId)
            nav.navigate("BookingDetail", { id: r.refId });
          else if (r.type === "payment" && r.refId)
            nav.navigate("PaymentDetail", { id: r.refId });
        }}
        phoneTitle={(r) => (
          <Col gap={2}>
            <Text variant="caption" tone="faint">
              {formatDate(r.date)}
            </Text>
            <Text numberOfLines={2}>
              {r.type === "consignment"
                ? `Booking · ${r.description}`
                : r.description}
            </Text>
          </Col>
        )}
        phoneRight={(r) => <Balance value={r.balance} />}
        empty={
          <EmptyState
            icon={BookOpen}
            title={
              filtered ? "No entries in this period" : "No transactions yet"
            }
            message={
              filtered
                ? "Widen the date range to see more."
                : "Bookings on credit and payments received will appear here with a running balance."
            }
            action={filtered ? undefined : emptyAction}
          />
        }
      />

      {rows && view.inRange.length ? (
        <Card tone="sunken" testID="party-ledger-totals">
          <Row wrap gap={16} justify="space-between">
            <Col gap={2}>
              <Text variant="overline" tone="muted">
                Total debit
              </Text>
              <Money value={view.debit} variant="h3" />
            </Col>
            <Col gap={2}>
              <Text variant="overline" tone="muted">
                Total credit
              </Text>
              <Money value={view.credit} variant="h3" />
            </Col>
            <Col gap={2} align={isPhone ? "flex-start" : "flex-end"}>
              <Text variant="overline" tone="muted">
                {filtered ? "Closing balance" : "Outstanding"}
              </Text>
              <Balance value={view.closing} variant="h2" />
            </Col>
          </Row>
        </Card>
      ) : null}
    </Col>
  );
}
