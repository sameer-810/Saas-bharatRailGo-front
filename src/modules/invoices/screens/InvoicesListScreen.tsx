/** GST invoices: filter by status / party / dates. */
import React, { useState } from "react";
import { FileText, Plus } from "lucide-react-native";
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
  StatusPill,
  Text,
  type Column,
} from "@shared/ui";
import { useLayout, useTheme } from "@shared/useTheme";
import { useApiList } from "@shared/api/query";
import { loadPartyOptions } from "@shared/api/lookups";
import { formatDate } from "@shared/lib/format";
import { useReadOnly } from "@shared/lib/permissions";
import { useAppNav } from "@navigation/useAppNav";
import {
  INVOICE_STATUSES,
  INVOICE_STATUS_LABEL,
  invoicePartyName,
  type Invoice,
  type InvoiceStatus,
} from "../types";

export function InvoicesListScreen() {
  const t = useTheme();
  const { isPhone } = useLayout();
  const nav = useAppNav();
  const readOnly = useReadOnly();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<InvoiceStatus | null>(null);
  const [party, setParty] = useState<{ id: string; name: string } | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const list = useApiList<Invoice>("invoices", "/invoices", {
    page,
    limit: 20,
    status: status ?? undefined,
    party: party?.id,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const filtered = !!(status || party || startDate || endDate);
  const withReset = <T,>(fn: (v: T) => void) => (v: T) => {
    setPage(1);
    fn(v);
  };

  const mono = { fontFamily: t.fonts.mono };
  const columns: Column<Invoice>[] = [
    {
      key: "bill",
      title: "Bill no.",
      flex: 0.9,
      render: (i) => (
        <Text variant="bodyStrong" style={mono} testID={`invoice-bill-${i.id}`}>
          {i.billNumber || "—"}
        </Text>
      ),
    },
    { key: "date", title: "Date", flex: 0.9, render: (i) => <Text>{formatDate(i.date)}</Text> },
    {
      key: "party",
      title: "Party",
      flex: 1.8,
      render: (i) => (
        <Text numberOfLines={1}>{invoicePartyName(i)}</Text>
      ),
    },
    {
      key: "lines",
      title: "Bookings",
      flex: 0.6,
      align: "right",
      hideOnPhone: true,
      render: (i) => <Text tone="muted">{i.consignments?.length ?? 0}</Text>,
    },
    { key: "status", title: "Status", flex: 0.9, render: (i) => <StatusPill status={i.status} /> },
    { key: "gross", title: "Gross total", flex: 1.1, align: "right", render: (i) => <Money value={i.grossTotal} variant="bodyStrong" /> },
  ];

  return (
    <Screen
      title="Invoices"
      subtitle="GST bills for on-bill parties"
      testID="invoices-screen"
      refreshing={list.isRefetching}
      onRefresh={() => list.refetch()}
      actions={
        <Button
          title="New invoice"
          icon={Plus}
          onPress={() => nav.navigate("InvoiceNew")}
          disabled={readOnly}
          testID="invoices-new"
        />
      }
    >
      <Col gap={16}>
        {readOnly ? (
          <Banner
            tone="warning"
            title="Read-only"
            message="Your subscription has expired. Renew your plan to create invoices."
            testID="invoices-readonly"
          />
        ) : null}

        <Row gap={8} wrap>
          <Chip label="All" selected={!status} onPress={() => withReset(setStatus)(null)} testID="invoices-status-all" />
          {INVOICE_STATUSES.map((s) => (
            <Chip
              key={s}
              label={INVOICE_STATUS_LABEL[s]}
              selected={status === s}
              onPress={() => withReset(setStatus)(status === s ? null : s)}
              testID={`invoices-status-${s}`}
            />
          ))}
        </Row>

        <Row gap={12} wrap align="flex-end">
          <Col style={{ flexGrow: 1, flexBasis: isPhone ? "100%" : 260 }}>
            <Combobox<string>
              label="Party"
              placeholder="All parties"
              valueLabel={party?.name}
              selectedValue={party?.id ?? null}
              loadOptions={loadPartyOptions}
              onPick={(o) => {
                setPage(1);
                setParty(o ? { id: o.value, name: o.label } : null);
              }}
              clearable
              testID="invoices-filter-party"
            />
          </Col>
          <Col style={{ flexGrow: 1, flexBasis: isPhone ? "45%" : 170 }}>
            <DateField label="From" value={startDate} onChange={withReset(setStartDate)} quick={false} testID="invoices-filter-from" />
          </Col>
          <Col style={{ flexGrow: 1, flexBasis: isPhone ? "45%" : 170 }}>
            <DateField label="To" value={endDate} onChange={withReset(setEndDate)} quick={false} testID="invoices-filter-to" />
          </Col>
          {filtered ? (
            <Button
              title="Clear"
              variant="ghost"
              size="sm"
              onPress={() => {
                setPage(1);
                setStatus(null);
                setParty(null);
                setStartDate("");
                setEndDate("");
              }}
              testID="invoices-clear-filters"
            />
          ) : null}
        </Row>

        <DataList
          testID="invoices-list"
          rows={list.data?.items}
          columns={columns}
          keyOf={(i) => i.id}
          loading={list.isLoading || list.isFetching}
          error={list.error}
          onRetry={() => list.refetch()}
          onRowPress={(i) => nav.navigate("InvoiceDetail", { id: i.id })}
          paging={list.data?.meta}
          onPage={setPage}
          phoneTitle={(i) => (
            <Col gap={2}>
              <Text variant="bodyStrong" style={mono}>
                {i.billNumber || "—"}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {invoicePartyName(i)}
              </Text>
            </Col>
          )}
          phoneRight={(i) => <Money value={i.grossTotal} variant="bodyStrong" />}
          empty={
            <EmptyState
              icon={FileText}
              title={filtered ? "No invoices match these filters" : "No invoices yet"}
              message={
                filtered
                  ? "Try another status, party or date range."
                  : "Bill an on-bill party for their bookings. GST is worked out for you, and railway freight stays non-taxable."
              }
              action={
                filtered ? undefined : (
                  <Button
                    title="New invoice"
                    icon={Plus}
                    onPress={() => nav.navigate("InvoiceNew")}
                    disabled={readOnly}
                    testID="invoices-empty-new"
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
