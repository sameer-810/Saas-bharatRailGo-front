/** Parties (customers) — searchable, paged list. */
import React, { useState } from "react";
import { Plus, Users } from "lucide-react-native";
import {
  Banner,
  Button,
  Col,
  DataList,
  EmptyState,
  Money,
  Screen,
  SearchInput,
  Text,
  type Column,
} from "@shared/ui";
import { useTheme } from "@shared/useTheme";
import { useApiList } from "@shared/api/query";
import { useReadOnly } from "@shared/lib/permissions";
import { useDebounced } from "@shared/hooks/useDebounced";
import { useAppNav } from "@navigation/useAppNav";
import { paymentModeLabel, type Party } from "../types";

export function PartyListScreen() {
  const t = useTheme();
  const nav = useAppNav();
  const readOnly = useReadOnly();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const list = useApiList<Party>("parties", "/parties", {
    page,
    limit: 20,
    search: q,
  });

  const columns: Column<Party>[] = [
    {
      key: "name",
      title: "Name",
      flex: 2.2,
      render: (p) => (
        <Col gap={0}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {p.name}
          </Text>
          {p.gstin ? (
            <Text
              variant="caption"
              tone="faint"
              style={{ fontFamily: t.fonts.mono }}
            >
              {p.gstin}
            </Text>
          ) : null}
        </Col>
      ),
    },
    {
      key: "mobile",
      title: "Mobile",
      flex: 1.2,
      render: (p) => (
        <Text style={{ fontFamily: t.fonts.mono }}>{p.mobile || "—"}</Text>
      ),
    },
    {
      key: "city",
      title: "City",
      flex: 1,
      render: (p) => <Text tone="muted">{p.city || "—"}</Text>,
    },
    {
      key: "station",
      title: "Station",
      flex: 0.8,
      render: (p) => (
        <Text style={{ fontFamily: t.fonts.mono }}>
          {p.defaultStation || "—"}
        </Text>
      ),
    },
    {
      key: "mode",
      title: "Payment mode",
      flex: 1.2,
      hideOnPhone: true,
      render: (p) => (
        <Text tone="muted">{paymentModeLabel(p.defaultPaymentMode)}</Text>
      ),
    },
    {
      key: "opening",
      title: "Opening bal.",
      flex: 1,
      align: "right",
      hideOnPhone: true,
      render: (p) => (
        <Money
          value={p.openingBalance}
          tone={p.openingBalance ? "default" : "faint"}
        />
      ),
    },
  ];

  return (
    <Screen
      title="Parties"
      subtitle="Customers you book for and bill"
      testID="party-list-screen"
      refreshing={list.isRefetching}
      onRefresh={() => list.refetch()}
      actions={
        <Button
          testID="party-new"
          title="New party"
          icon={Plus}
          disabled={readOnly}
          onPress={() => nav.navigate("PartyNew")}
        />
      }
    >
      <Col gap={12} style={{ marginBottom: 16 }}>
        {readOnly ? (
          <Banner
            tone="warning"
            title="Read-only mode"
            message="Your subscription has expired. Renew to add parties."
            testID="party-readonly"
          />
        ) : null}
        <SearchInput
          testID="party-search"
          value={search}
          onChangeText={(s) => {
            setSearch(s);
            setPage(1);
          }}
          placeholder="Search by name, mobile or GSTIN"
        />
      </Col>
      <DataList<Party>
        testID="party-list"
        rows={list.data?.items}
        columns={columns}
        keyOf={(p) => p.id}
        loading={list.isLoading || list.isFetching}
        error={list.error}
        onRetry={() => list.refetch()}
        paging={list.data?.meta}
        onPage={setPage}
        onRowPress={(p) => nav.navigate("PartyDetail", { id: p.id })}
        empty={
          <EmptyState
            icon={Users}
            title={q ? "No parties match" : "No parties yet"}
            message={
              q
                ? "Try another name or mobile number."
                : "Save your regular customers once and pick them on every booking, bilti and bill."
            }
            action={
              q ? undefined : (
                <Button
                  testID="party-empty-new"
                  title="New party"
                  icon={Plus}
                  disabled={readOnly}
                  onPress={() => nav.navigate("PartyNew")}
                />
              )
            }
          />
        }
      />
    </Screen>
  );
}
