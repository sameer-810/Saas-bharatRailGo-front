/** Payments received: filter by party / mode / dates, with page totals. */
import React, { useMemo, useState } from "react";
import { Plus, Wallet } from "lucide-react-native";
import {
  Banner,
  Button,
  Chip,
  Col,
  Combobox,
  DataList,
  DateField,
  EmptyState,
  Money,
  Row,
  Screen,
  StatTile,
  Text,
  type Column,
} from "@shared/ui";
import { useTheme, useLayout } from "@shared/useTheme";
import { useApiList } from "@shared/api/query";
import { loadPartyOptions } from "@shared/api/lookups";
import { formatDate } from "@shared/lib/format";
import { useReadOnly } from "@shared/lib/permissions";
import { useAppNav } from "@navigation/useAppNav";
import { round2 } from "../lib";
import {
  PAYMENT_MODES,
  PAYMENT_MODE_LABEL,
  partyName,
  type Payment,
  type PaymentMode,
} from "../types";

export function PaymentsListScreen() {
  const t = useTheme();
  const { isPhone } = useLayout();
  const nav = useAppNav();
  const readOnly = useReadOnly();

  const [page, setPage] = useState(1);
  const [party, setParty] = useState<{ id: string; name: string } | null>(null);
  const [mode, setMode] = useState<PaymentMode | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const list = useApiList<Payment>("payments", "/payments", {
    page,
    limit: 20,
    party: party?.id,
    mode: mode ?? undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });
  const rows = list.data?.items;

  const totals = useMemo(() => {
    const items = rows || [];
    const amount = round2(items.reduce((s, p) => s + (p.amount || 0), 0));
    const advance = round2(
      items.reduce((s, p) => s + (p.unallocatedAmount || 0), 0),
    );
    return {
      amount,
      advance,
      allocated: round2(amount - advance),
      count: items.length,
    };
  }, [rows]);

  const filtered = !!(party || mode || startDate || endDate);
  const resetPage =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      setPage(1);
      fn(v);
    };

  const columns: Column<Payment>[] = [
    {
      key: "date",
      title: "Date",
      flex: 0.9,
      render: (p) => <Text>{formatDate(p.date)}</Text>,
    },
    {
      key: "party",
      title: "Party",
      flex: 1.6,
      render: (p) => (
        <Text variant="bodyStrong" numberOfLines={1}>
          {partyName(p.party)}
        </Text>
      ),
    },
    {
      key: "mode",
      title: "Mode",
      flex: 0.9,
      render: (p) => (
        <Text tone="muted">{PAYMENT_MODE_LABEL[p.mode] ?? p.mode}</Text>
      ),
    },
    {
      key: "ref",
      title: "Reference",
      flex: 1.1,
      hideOnPhone: true,
      render: (p) => (
        <Text
          style={{ fontFamily: t.fonts.mono }}
          tone={p.referenceNumber ? "default" : "faint"}
          numberOfLines={1}
        >
          {p.referenceNumber || "—"}
        </Text>
      ),
    },
    {
      key: "split",
      title: "Allocated / advance",
      flex: 1.3,
      render: (p) => (
        <Col gap={0}>
          <Money
            value={round2(p.amount - (p.unallocatedAmount || 0))}
            variant="caption"
            tone="muted"
          />
          {p.unallocatedAmount > 0 ? (
            <Text variant="caption" tone="accent">
              +{" "}
              <Money
                value={p.unallocatedAmount}
                variant="caption"
                tone="accent"
              />{" "}
              advance
            </Text>
          ) : null}
        </Col>
      ),
    },
    {
      key: "amount",
      title: "Amount",
      flex: 1,
      align: "right",
      render: (p) => <Money value={p.amount} variant="bodyStrong" />,
    },
  ];

  return (
    <Screen
      title="Payments"
      subtitle="Money received from parties, split oldest-first across their open bookings"
      testID="payments-screen"
      refreshing={list.isRefetching}
      onRefresh={() => list.refetch()}
      actions={
        <Button
          title="Record payment"
          icon={Plus}
          onPress={() => nav.navigate("PaymentNew")}
          disabled={readOnly}
          testID="payments-new"
        />
      }
    >
      <Col gap={16}>
        {readOnly ? (
          <Banner
            tone="warning"
            title="Read-only"
            message="Your subscription has expired. Renew your plan to record payments."
            testID="payments-readonly"
          />
        ) : null}

        <Col gap={12}>
          <Row gap={12} wrap align="flex-end">
            <Col style={{ flexGrow: 1, flexBasis: isPhone ? "100%" : 260 }}>
              <Combobox<string>
                label="Party"
                placeholder="All parties"
                valueLabel={party?.name}
                selectedValue={party?.id ?? null}
                loadOptions={loadPartyOptions}
                onPick={resetPage(
                  (o: { value: string; label: string } | null) =>
                    setParty(o ? { id: o.value, name: o.label } : null),
                )}
                clearable
                testID="payments-filter-party"
              />
            </Col>
            <Col style={{ flexGrow: 1, flexBasis: isPhone ? "45%" : 170 }}>
              <DateField
                label="From"
                value={startDate}
                onChange={resetPage(setStartDate)}
                quick={false}
                testID="payments-filter-from"
              />
            </Col>
            <Col style={{ flexGrow: 1, flexBasis: isPhone ? "45%" : 170 }}>
              <DateField
                label="To"
                value={endDate}
                onChange={resetPage(setEndDate)}
                quick={false}
                testID="payments-filter-to"
              />
            </Col>
          </Row>
          <Row gap={8} wrap>
            <Chip
              label="All modes"
              selected={!mode}
              onPress={() => resetPage(setMode)(null)}
              testID="payments-mode-all"
            />
            {PAYMENT_MODES.map((m) => (
              <Chip
                key={m}
                label={PAYMENT_MODE_LABEL[m]}
                selected={mode === m}
                onPress={() => resetPage(setMode)(mode === m ? null : m)}
                testID={`payments-mode-${m}`}
              />
            ))}
            {filtered ? (
              <Button
                title="Clear filters"
                variant="ghost"
                size="sm"
                onPress={() => {
                  setPage(1);
                  setParty(null);
                  setMode(null);
                  setStartDate("");
                  setEndDate("");
                }}
                testID="payments-clear-filters"
              />
            ) : null}
          </Row>
        </Col>

        {rows && rows.length > 0 ? (
          <Row gap={12} wrap testID="payments-page-totals">
            <StatTile
              label="Received (this page)"
              value={<Money value={totals.amount} variant="h2" />}
              hint={`${totals.count} payments`}
            />
            <StatTile
              label="Allocated"
              value={<Money value={totals.allocated} variant="h2" />}
              tone="success"
            />
            <StatTile
              label="Advance"
              value={<Money value={totals.advance} variant="h2" />}
              hint="Not yet matched to a booking"
            />
          </Row>
        ) : null}

        <DataList
          testID="payments-list"
          rows={rows}
          columns={columns}
          keyOf={(p) => p.id}
          loading={list.isLoading || list.isFetching}
          error={list.error}
          onRetry={() => list.refetch()}
          onRowPress={(p) => nav.navigate("PaymentDetail", { id: p.id })}
          paging={list.data?.meta}
          onPage={setPage}
          phoneTitle={(p) => (
            <Col gap={2}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {partyName(p.party)}
              </Text>
              <Text variant="caption" tone="faint">
                {formatDate(p.date)} · {PAYMENT_MODE_LABEL[p.mode] ?? p.mode}
              </Text>
            </Col>
          )}
          phoneRight={(p) => <Money value={p.amount} variant="bodyStrong" />}
          empty={
            <EmptyState
              icon={Wallet}
              title={
                filtered ? "No payments match these filters" : "No payments yet"
              }
              message={
                filtered
                  ? "Try a different party, mode or date range."
                  : "Record the money a party pays you. It is matched to their oldest open bookings automatically."
              }
              action={
                filtered ? undefined : (
                  <Button
                    title="Record payment"
                    icon={Plus}
                    onPress={() => nav.navigate("PaymentNew")}
                    disabled={readOnly}
                    testID="payments-empty-new"
                  />
                )
              }
            />
          }
        />
      </Col>
    </Screen>
  );
}
