/** All agencies (tenants) with filter chips, search and paging. */
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Building2 } from "lucide-react-native";
import {
  Col,
  DataList,
  EmptyState,
  Row,
  Screen,
  SearchInput,
  Chip,
  Text,
  Button,
  type Column,
} from "@shared/ui";
import { useLayout, useTheme } from "@shared/useTheme";
import { formatDate } from "@shared/lib/format";
import { useDebounced } from "@shared/hooks/useDebounced";
import { useAdminNav, useParams } from "@navigation/useAppNav";
import { apiErrorMessage } from "@shared/api/apiClient";
import { useAdminOrgs, type AdminOrg, type OrgListParams } from "../api";
import { OrgPills, SubscriptionCell } from "../components/OrgBits";

type FilterKey =
  | "all"
  | "pending"
  | "trial"
  | "active"
  | "past_due"
  | "suspended"
  | "rejected"
  | "deletion";

const FILTERS: { key: FilterKey; label: string; params: OrgListParams }[] = [
  { key: "all", label: "All", params: {} },
  { key: "pending", label: "Pending", params: { approvalStatus: "pending" } },
  { key: "trial", label: "Trial", params: { subscriptionStatus: "trial" } },
  { key: "active", label: "Active", params: { subscriptionStatus: "active" } },
  {
    key: "past_due",
    label: "Past due",
    params: { subscriptionStatus: "past_due" },
  },
  { key: "suspended", label: "Suspended", params: { status: "suspended" } },
  {
    key: "rejected",
    label: "Rejected",
    params: { approvalStatus: "rejected" },
  },
  {
    key: "deletion",
    label: "Deletion requested",
    params: { deletionRequested: "true" },
  },
];

type RouteParams = {
  approvalStatus?: string;
  subscriptionStatus?: string;
  status?: string;
  filter?: string;
};

function filterFromParams(p: Partial<RouteParams>): FilterKey {
  if (p.filter && FILTERS.some((f) => f.key === p.filter))
    return p.filter as FilterKey;
  if (p.approvalStatus === "pending") return "pending";
  if (p.approvalStatus === "rejected") return "rejected";
  if (p.status === "suspended") return "suspended";
  if (p.subscriptionStatus === "trial") return "trial";
  if (p.subscriptionStatus === "active") return "active";
  if (p.subscriptionStatus === "past_due") return "past_due";
  return "all";
}

export function AdminOrgsScreen() {
  const t = useTheme();
  const { isPhone } = useLayout();
  const nav = useAdminNav();
  const params = useParams<RouteParams>();
  const [filter, setFilter] = useState<FilterKey>(() =>
    filterFromParams(params),
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(search);

  // Follow route param changes (e.g. dashboard tile → AdminOrgs { approvalStatus: "pending" }).
  useEffect(() => {
    setFilter(filterFromParams(params));
    setPage(1);
  }, [
    params.approvalStatus,
    params.subscriptionStatus,
    params.status,
    params.filter,
  ]);

  useEffect(() => setPage(1), [q]);

  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const list = useAdminOrgs({
    ...active.params,
    search: q || undefined,
    page,
    limit: 20,
  });

  const mono = { fontFamily: t.fonts.mono };
  const columns: Column<AdminOrg>[] = [
    {
      key: "name",
      title: "Agency",
      flex: 2,
      render: (o) => (
        <Col gap={2}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {o.name}
          </Text>
          <Text variant="caption" tone="faint" numberOfLines={1}>
            {o.email || o.slug}
          </Text>
        </Col>
      ),
    },
    {
      key: "city",
      title: "City",
      flex: 1,
      render: (o) => <Text numberOfLines={1}>{o.city || "—"}</Text>,
    },
    {
      key: "gstin",
      title: "GSTIN",
      flex: 1.4,
      hideOnPhone: true,
      render: (o) => (
        <Text variant="caption" style={mono} numberOfLines={1}>
          {o.gstin || "—"}
        </Text>
      ),
    },
    {
      key: "status",
      title: "Approval / status",
      flex: 1.4,
      render: (o) => <OrgPills org={o} />,
    },
    {
      key: "sub",
      title: "Subscription",
      flex: 1.8,
      render: (o) => <SubscriptionCell sub={o.subscriptionState} />,
    },
    {
      key: "created",
      title: "Created",
      flex: 1,
      align: "right",
      render: (o) => (
        <Text variant="caption" tone="muted">
          {formatDate(o.createdAt)}
        </Text>
      ),
    },
  ];

  const pickFilter = (k: FilterKey) => {
    setFilter(k);
    setPage(1);
    nav.setParams({
      filter: k,
      approvalStatus: undefined,
      subscriptionStatus: undefined,
      status: undefined,
    });
  };

  return (
    <Screen
      title="Agencies"
      subtitle={
        list.data
          ? `${list.data.meta.total} ${active.key === "all" ? "total" : active.label.toLowerCase()}`
          : undefined
      }
      testID="admin-orgs"
    >
      <Col gap={12} style={{ marginBottom: 16 }}>
        <Row gap={8} wrap testID="admin-orgs-filters">
          {FILTERS.map((f) => (
            <Chip
              key={f.key}
              label={f.label}
              selected={filter === f.key}
              onPress={() => pickFilter(f.key)}
              testID={`admin-orgs-filter-${f.key}`}
            />
          ))}
        </Row>
        <View style={{ maxWidth: isPhone ? undefined : 420 }}>
          <SearchInput
            testID="admin-orgs-search"
            value={search}
            onChangeText={setSearch}
            placeholder="Search name, email, GSTIN, city"
          />
        </View>
      </Col>
      <DataList
        testID="admin-orgs-list"
        rows={list.data?.items}
        columns={columns}
        keyOf={(o) => o.id}
        onRowPress={(o) => nav.navigate("AdminOrgDetail", { id: o.id })}
        loading={list.isLoading || list.isFetching}
        error={
          list.error ? { message: apiErrorMessage(list.error) } : undefined
        }
        onRetry={() => list.refetch()}
        paging={list.data?.meta}
        onPage={setPage}
        phoneRight={(o) => <OrgPills org={o} />}
        empty={
          <EmptyState
            icon={Building2}
            title={q ? "No agencies match your search" : "No agencies here"}
            message={
              q
                ? "Try a different name, GSTIN or city."
                : "Agencies in this state will be listed here."
            }
            action={
              filter !== "all" || q ? (
                <Button
                  title="Show all agencies"
                  variant="secondary"
                  testID="admin-orgs-clear"
                  onPress={() => {
                    setSearch("");
                    pickFilter("all");
                  }}
                />
              ) : undefined
            }
          />
        }
      />
    </Screen>
  );
}
