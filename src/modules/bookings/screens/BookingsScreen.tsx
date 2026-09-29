/** Bookings list — quick entry on top, filters, paged DataList. */
import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { ClipboardList, FileBarChart, PackagePlus, SlidersHorizontal } from "lucide-react-native";
import {
  Button,
  Card,
  Chip,
  Col,
  Combobox,
  DataList,
  DateField,
  EmptyState,
  Money,
  Row,
  Screen,
  SearchInput,
  Select,
  StatusPill,
  Text,
  type Column,
} from "@shared/ui";
import { useLayout, useTheme } from "@shared/useTheme";
import { useApiGet, useApiList } from "@shared/api/query";
import { loadPartyOptions, loadStationOptions, type PartyLite } from "@shared/api/lookups";
import { useReadOnly } from "@shared/lib/permissions";
import { formatDate, formatNumber } from "@shared/lib/format";
import { useDebounced } from "@shared/hooks/useDebounced";
import { useAppNav, useParams } from "@navigation/useAppNav";
import { QuickEntryBar } from "../components/QuickEntryBar";
import {
  DELIVERY_LABEL,
  DELIVERY_STATUS,
  PAYMENT_MODE_LABEL,
  PAYMENT_STATUS_LABEL,
  partyName,
  paymentModeOptions,
  paymentStatusOptions,
  type Consignment,
  type DeliveryStatus,
  type PaymentMode,
  type PaymentStatus,
} from "../lib/types";

export function BookingsScreen() {
  const t = useTheme();
  const { isPhone } = useLayout();
  const nav = useAppNav();
  const readOnly = useReadOnly();
  const params = useParams<{ destinationStation: string; partyId: string; startDate: string; endDate: string }>();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState<string | undefined>(
    params.startDate ? String(params.startDate) : undefined,
  );
  const [endDate, setEndDate] = useState<string | undefined>(
    params.endDate ? String(params.endDate) : undefined,
  );
  const [party, setParty] = useState<{ value: string; label?: string } | null>(
    params.partyId ? { value: String(params.partyId) } : null,
  );
  const [station, setStation] = useState<string | null>(
    params.destinationStation ? String(params.destinationStation).toUpperCase() : null,
  );
  const [paymentMode, setPaymentMode] = useState<PaymentMode | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus | null>(null);
  const [showFilters, setShowFilters] = useState(!isPhone || !!params.partyId || !!params.destinationStation);

  // Route params can change while the screen stays mounted.
  useEffect(() => {
    if (params.partyId) setParty({ value: String(params.partyId) });
    if (params.destinationStation) setStation(String(params.destinationStation).toUpperCase());
    if (params.startDate) setStartDate(String(params.startDate));
    if (params.endDate) setEndDate(String(params.endDate));
  }, [params.partyId, params.destinationStation, params.startDate, params.endDate]);

  // Label for a party that came in via route params.
  const partyLookup = useApiGet<PartyLite>(
    ["parties", party?.value],
    party && !party.label ? `/parties/${party.value}` : null,
  );
  const partyLabel = party?.label ?? partyLookup.data?.name;

  const q = useDebounced(search);
  const filters = {
    search: q || undefined,
    party: party?.value,
    destinationStation: station || undefined,
    paymentMode: paymentMode || undefined,
    paymentStatus: paymentStatus || undefined,
    deliveryStatus: deliveryStatus || undefined,
    startDate,
    endDate,
  };
  const filterKey = JSON.stringify(filters);
  useEffect(() => setPage(1), [filterKey]);

  const list = useApiList<Consignment>("consignments", "/consignments", { page, limit: 20, ...filters });
  const activeCount = [party, station, paymentMode, paymentStatus, deliveryStatus, startDate, endDate].filter(Boolean).length;

  const clearAll = () => {
    setSearch("");
    setStartDate(undefined);
    setEndDate(undefined);
    setParty(null);
    setStation(null);
    setPaymentMode(null);
    setPaymentStatus(null);
    setDeliveryStatus(null);
  };

  const mono = { fontFamily: t.fonts.mono };
  const columns: Column<Consignment>[] = useMemo(
    () => [
      {
        key: "date",
        title: "Date",
        flex: 0.9,
        render: (c) => (
          <View testID={`booking-row-${c.id}`}>
            <Text>{formatDate(c.date)}</Text>
            {c.railwayReceiptNumber ? (
              <Text variant="caption" tone="faint" style={mono}>
                RR {c.railwayReceiptNumber}
              </Text>
            ) : null}
          </View>
        ),
      },
      {
        key: "party",
        title: "Party",
        flex: 1.6,
        hideOnPhone: true,
        render: (c) => (
          <Text numberOfLines={1} variant="bodyStrong">
            {partyName(c)}
          </Text>
        ),
      },
      {
        key: "route",
        title: "Route",
        flex: 1.1,
        hideOnPhone: true,
        render: (c) => (
          <Text style={mono}>
            {c.originStation} → {c.destinationStation}
          </Text>
        ),
      },
      {
        key: "load",
        title: "Pkgs / Wt",
        flex: 1,
        render: (c) => (
          <Text style={mono} tone="muted">
            {c.packages} pkg · {formatNumber(c.chargeableWeight)} kg
          </Text>
        ),
      },
      {
        key: "total",
        title: "Total",
        flex: 1,
        align: "right",
        hideOnPhone: true,
        render: (c) => (
          <Col gap={0} align="flex-end">
            <Money value={c.totalAmount} />
            <Text variant="caption" tone="faint">
              {PAYMENT_MODE_LABEL[c.paymentMode] ?? c.paymentMode}
            </Text>
          </Col>
        ),
      },
      {
        key: "status",
        title: "Status",
        flex: 1.3,
        render: (c) => (
          <Row gap={6} wrap>
            <StatusPill status={c.paymentStatus} label={PAYMENT_STATUS_LABEL[c.paymentStatus]} />
            <StatusPill status={c.deliveryStatus} label={DELIVERY_LABEL[c.deliveryStatus]} />
          </Row>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  );

  return (
    <Screen
      title="Bookings"
      testID="bookings-screen"
      actions={
        <>
          <Button
            title="Daily summary"
            variant="secondary"
            icon={FileBarChart}
            size={isPhone ? "sm" : "md"}
            onPress={() => nav.navigate("DailySummary")}
            testID="bookings-daily-summary"
          />
          <Button
            title="Loading list"
            variant="secondary"
            icon={ClipboardList}
            size={isPhone ? "sm" : "md"}
            onPress={() => nav.navigate("LoadingList")}
            testID="bookings-loading-list"
          />
          <Button
            title="New booking"
            icon={PackagePlus}
            size={isPhone ? "sm" : "md"}
            disabled={readOnly}
            onPress={() => nav.navigate("BookingNew")}
            testID="booking-new"
          />
        </>
      }
      refreshing={list.isRefetching}
      onRefresh={list.refetch}
    >
      <Col gap={16}>
        {!readOnly ? <QuickEntryBar onSubmit={(p) => nav.navigate("BookingNew", { ...p })} /> : null}

        <Col gap={10}>
          <Row gap={8} align="flex-start">
            <View style={{ flex: 1 }}>
              <SearchInput
                testID="bookings-search"
                value={search}
                onChangeText={setSearch}
                placeholder="Search RR no., station, contents"
              />
            </View>
            <Button
              title={activeCount ? `Filters · ${activeCount}` : "Filters"}
              variant={showFilters ? "secondary" : "ghost"}
              icon={SlidersHorizontal}
              onPress={() => setShowFilters((s) => !s)}
              testID="bookings-filters-toggle"
            />
          </Row>

          {showFilters ? (
            <Card padding={12} testID="bookings-filters">
              <Col gap={12}>
                <Row gap={12} wrap align="flex-start">
                  <View style={{ flexGrow: 1, flexBasis: 150 }}>
                    <DateField testID="bookings-from" label="From" value={startDate} onChange={(v) => setStartDate(v || undefined)} quick={false} />
                  </View>
                  <View style={{ flexGrow: 1, flexBasis: 150 }}>
                    <DateField testID="bookings-to" label="To" value={endDate} onChange={(v) => setEndDate(v || undefined)} quick={false} />
                  </View>
                  <View style={{ flexGrow: 2, flexBasis: 220 }}>
                    <Combobox<string>
                      testID="bookings-party"
                      label="Party"
                      placeholder="Any party"
                      valueLabel={party ? partyLabel || "Selected party" : undefined}
                      selectedValue={party?.value ?? null}
                      loadOptions={loadPartyOptions}
                      onPick={(o) => setParty(o ? { value: o.value, label: o.label } : null)}
                      clearable
                    />
                  </View>
                  <View style={{ flexGrow: 1, flexBasis: 160 }}>
                    <Combobox<string>
                      testID="bookings-station"
                      label="Destination"
                      placeholder="Any station"
                      valueLabel={station ?? undefined}
                      selectedValue={station}
                      loadOptions={loadStationOptions}
                      onPick={(o) => setStation(o ? o.value : null)}
                      clearable
                    />
                  </View>
                  <View style={{ flexGrow: 1, flexBasis: 150 }}>
                    <Select<PaymentMode>
                      testID="bookings-paymentMode"
                      label="Payment mode"
                      placeholder="Any"
                      value={paymentMode}
                      options={paymentModeOptions}
                      onChange={setPaymentMode}
                      clearable
                    />
                  </View>
                  <View style={{ flexGrow: 1, flexBasis: 150 }}>
                    <Select<PaymentStatus>
                      testID="bookings-paymentStatus"
                      label="Payment status"
                      placeholder="Any"
                      value={paymentStatus}
                      options={paymentStatusOptions}
                      onChange={setPaymentStatus}
                      clearable
                    />
                  </View>
                </Row>
                <Row gap={6} wrap testID="bookings-delivery-chips">
                  <Chip
                    label="All deliveries"
                    selected={!deliveryStatus}
                    onPress={() => setDeliveryStatus(null)}
                    testID="bookings-delivery-all"
                  />
                  {DELIVERY_STATUS.map((s) => (
                    <Chip
                      key={s}
                      label={DELIVERY_LABEL[s]}
                      selected={deliveryStatus === s}
                      onPress={() => setDeliveryStatus(deliveryStatus === s ? null : s)}
                      testID={`bookings-delivery-${s}`}
                    />
                  ))}
                  {activeCount || search ? (
                    <Button size="sm" variant="ghost" title="Clear all" onPress={clearAll} testID="bookings-clear-filters" />
                  ) : null}
                </Row>
              </Col>
            </Card>
          ) : null}
        </Col>

        {list.data?.meta ? (
          <Text variant="caption" tone="muted" testID="bookings-count">
            {list.data.meta.total} booking{list.data.meta.total === 1 ? "" : "s"}
          </Text>
        ) : null}

        <DataList<Consignment>
          testID="bookings-list"
          rows={list.data?.items}
          columns={columns}
          keyOf={(c) => c.id}
          loading={list.isLoading || list.isFetching}
          error={list.error}
          onRetry={list.refetch}
          onRowPress={(c) => nav.navigate("BookingDetail", { id: c.id })}
          paging={list.data?.meta}
          onPage={setPage}
          phoneTitle={(c) => (
            <View testID={`booking-row-${c.id}`}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {partyName(c)}
              </Text>
              <Text variant="caption" tone="muted" style={mono}>
                {formatDate(c.date)} · {c.originStation} → {c.destinationStation}
              </Text>
            </View>
          )}
          phoneRight={(c) => <Money value={c.totalAmount} />}
          empty={
            activeCount || q ? (
              <EmptyState
                title="No bookings match"
                message="Try a different date range or clear the filters."
                action={<Button title="Clear filters" variant="secondary" onPress={clearAll} testID="bookings-empty-clear" />}
              />
            ) : (
              <EmptyState
                icon={PackagePlus}
                title="No bookings yet"
                message="Type a line in quick entry above, or start a full booking form."
                action={
                  <Button
                    title="New booking"
                    icon={PackagePlus}
                    disabled={readOnly}
                    onPress={() => nav.navigate("BookingNew")}
                    testID="bookings-empty-new"
                  />
                }
              />
            )
          }
        />
      </Col>
    </Screen>
  );
}
