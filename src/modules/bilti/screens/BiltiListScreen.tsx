/** Bilti (POD) register — search, status chips, destination + date filters. */
import React, { useState } from "react";
import { ScrollView } from "react-native";
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
  SearchInput,
  StatusPill,
  Text,
  type Column,
} from "@shared/ui";
import { useLayout, useTheme } from "@shared/useTheme";
import { useApiList } from "@shared/api/query";
import { loadStationOptions, useBusinessProfile } from "@shared/api/lookups";
import { useReadOnly } from "@shared/lib/permissions";
import { formatDate } from "@shared/lib/format";
import { useDebounced } from "@shared/hooks/useDebounced";
import { useAppNav } from "@navigation/useAppNav";
import {
  DELIVERY_STATUSES,
  STATUS_LABEL,
  biltiNo,
  type DeliveryStatus,
  type Pod,
} from "../types";

export function BiltiListScreen() {
  const t = useTheme();
  const nav = useAppNav();
  const { isPhone } = useLayout();
  const readOnly = useReadOnly();
  const profile = useBusinessProfile();
  const prefix = profile.data?.podNumberPrefix;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<DeliveryStatus | "">("");
  const [destination, setDestination] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const q = useDebounced(search);

  const list = useApiList<Pod>("pods", "/pods", {
    page,
    limit: 20,
    search: q,
    deliveryStatus: status,
    destinationStation: destination,
    startDate,
    endDate,
  });

  const reset =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(1);
    };

  const hasFilters = !!(q || status || destination || startDate || endDate);

  const columns: Column<Pod>[] = [
    {
      key: "no",
      title: "Bilti no.",
      flex: 1,
      render: (p) => (
        <Text style={{ fontFamily: t.fonts.mono }} testID={`bilti-no-${p.id}`}>
          {biltiNo(prefix, p.podNumber)}
        </Text>
      ),
    },
    {
      key: "date",
      title: "Date",
      flex: 1,
      render: (p) => <Text tone="muted">{formatDate(p.date)}</Text>,
    },
    {
      key: "parties",
      title: "Consignor → Consignee",
      flex: 2.4,
      render: (p) => (
        <Text numberOfLines={1}>
          {p.consignorName} <Text tone="faint">→</Text> {p.consigneeName}
        </Text>
      ),
    },
    {
      key: "dest",
      title: "To",
      flex: 0.8,
      render: (p) => (
        <Text style={{ fontFamily: t.fonts.mono }}>{p.destinationStation}</Text>
      ),
    },
    {
      key: "pkgs",
      title: "Pkgs",
      flex: 0.6,
      align: "right",
      render: (p) => (
        <Text style={{ fontFamily: t.fonts.mono }}>{p.packages}</Text>
      ),
    },
    {
      key: "total",
      title: "Total",
      flex: 1.1,
      align: "right",
      hideOnPhone: true,
      render: (p) => <Money value={p.totalAmount} />,
    },
    {
      key: "status",
      title: "Status",
      flex: 1.1,
      render: (p) => <StatusPill status={p.deliveryStatus} />,
    },
  ];

  return (
    <Screen
      title="Bilti"
      subtitle="Receipt slips for goods received at the godown"
      testID="bilti-list-screen"
      refreshing={list.isRefetching}
      onRefresh={() => list.refetch()}
      actions={
        <Button
          testID="bilti-new"
          title="New bilti"
          icon={Plus}
          disabled={readOnly}
          onPress={() => nav.navigate("BiltiNew")}
        />
      }
    >
      <Col gap={12} style={{ marginBottom: 16 }}>
        {readOnly ? (
          <Banner
            tone="warning"
            title="Read-only mode"
            message="Your subscription has expired. Renew to create new bilti."
            testID="bilti-readonly"
          />
        ) : null}
        <Row gap={8} align="flex-start">
          <Col flex={1}>
            <SearchInput
              testID="bilti-search"
              value={search}
              onChangeText={reset(setSearch)}
              placeholder="Search consignor, consignee, destination, RR no."
            />
          </Col>
          <Button
            testID="bilti-filters-toggle"
            title={
              isPhone
                ? "Filters"
                : showFilters
                  ? "Hide filters"
                  : "More filters"
            }
            variant="secondary"
            onPress={() => setShowFilters((s) => !s)}
          />
        </Row>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Row gap={6}>
            <Chip
              testID="bilti-status-all"
              label="All"
              selected={!status}
              onPress={() => reset(setStatus)("")}
            />
            {DELIVERY_STATUSES.map((s) => (
              <Chip
                key={s}
                testID={`bilti-status-${s}`}
                label={STATUS_LABEL[s]}
                selected={status === s}
                onPress={() => reset(setStatus)(status === s ? "" : s)}
              />
            ))}
          </Row>
        </ScrollView>
        {showFilters ? (
          <Row gap={12} wrap align="flex-start" testID="bilti-filters">
            <Col style={{ minWidth: 200, flexGrow: 1, flexBasis: 200 }}>
              <Combobox
                testID="bilti-filter-destination"
                label="Destination"
                placeholder="Any station"
                valueLabel={destination || undefined}
                selectedValue={destination || null}
                loadOptions={loadStationOptions}
                clearable
                onPick={(o) => reset(setDestination)(o ? o.value : "")}
              />
            </Col>
            <Col style={{ minWidth: 160, flexGrow: 1, flexBasis: 160 }}>
              <DateField
                testID="bilti-filter-from"
                label="From"
                value={startDate}
                onChange={reset(setStartDate)}
                quick={false}
              />
            </Col>
            <Col style={{ minWidth: 160, flexGrow: 1, flexBasis: 160 }}>
              <DateField
                testID="bilti-filter-to"
                label="To"
                value={endDate}
                onChange={reset(setEndDate)}
                quick={false}
              />
            </Col>
            {hasFilters ? (
              <Col style={{ alignSelf: "flex-end" }}>
                <Button
                  testID="bilti-filters-clear"
                  title="Clear"
                  variant="ghost"
                  onPress={() => {
                    setSearch("");
                    setStatus("");
                    setDestination("");
                    setStartDate("");
                    setEndDate("");
                    setPage(1);
                  }}
                />
              </Col>
            ) : null}
          </Row>
        ) : null}
      </Col>

      <DataList<Pod>
        testID="bilti-list"
        rows={list.data?.items}
        columns={columns}
        keyOf={(p) => p.id}
        loading={list.isLoading || list.isFetching}
        error={list.error}
        onRetry={() => list.refetch()}
        paging={list.data?.meta}
        onPage={setPage}
        onRowPress={(p) => nav.navigate("BiltiDetail", { id: p.id })}
        phoneTitle={(p) => (
          <Col gap={2}>
            <Text variant="bodyStrong" style={{ fontFamily: t.fonts.mono }}>
              {biltiNo(prefix, p.podNumber)} · {p.destinationStation}
            </Text>
            <Text tone="muted" numberOfLines={1}>
              {p.consignorName} → {p.consigneeName}
            </Text>
          </Col>
        )}
        phoneRight={(p) => <Money value={p.totalAmount} />}
        empty={
          <EmptyState
            icon={FileText}
            title={hasFilters ? "No bilti match these filters" : "No bilti yet"}
            message={
              hasFilters
                ? "Try a different search or clear the filters."
                : "Issue a bilti when goods arrive at the godown. It prints as the receipt slip."
            }
            action={
              hasFilters ? undefined : (
                <Button
                  testID="bilti-empty-new"
                  title="New bilti"
                  icon={Plus}
                  disabled={readOnly}
                  onPress={() => nav.navigate("BiltiNew")}
                />
              )
            }
          />
        }
      />
    </Screen>
  );
}
