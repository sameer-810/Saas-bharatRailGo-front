/** Platform overview: agency KPIs, MRR/ARR board, and pending signups to approve. */
import React, { useState } from "react";
import { View } from "react-native";
import {
  AlertTriangle,
  Ban,
  Building2,
  CheckCircle2,
  Clock,
  Hourglass,
  UserPlus,
} from "lucide-react-native";
import {
  Board,
  BoardText,
  Button,
  Card,
  Col,
  EmptyState,
  ErrorState,
  FlapText,
  LoadingBlock,
  Row,
  Screen,
  SectionHeader,
  StatTile,
  Text,
  toast,
} from "@shared/ui";
import { useLayout, useTheme } from "@shared/useTheme";
import { apiErrorMessage } from "@shared/api/apiClient";
import { formatDate, formatMoney, formatNumber } from "@shared/lib/format";
import { useAdminNav } from "@navigation/useAppNav";
import { adminActions, useAdminDashboard, useAdminMutation, useAdminOrgs, type AdminOrg } from "../api";

export function AdminDashboardScreen() {
  const t = useTheme();
  const { isPhone } = useLayout();
  const nav = useAdminNav();
  const dash = useAdminDashboard();
  const pending = useAdminOrgs({ approvalStatus: "pending", limit: 5, page: 1 });
  const approve = useAdminMutation((id: string) => adminActions.approve(id));
  const [busyId, setBusyId] = useState<string | null>(null);

  const onApprove = async (org: AdminOrg) => {
    setBusyId(org.id);
    try {
      const r = await approve.mutateAsync(org.id);
      toast.success(r.message || `${org.name} approved — trial started`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const refresh = () => {
    dash.refetch();
    pending.refetch();
  };

  const d = dash.data;
  const o = d?.organizations;
  const toOrgs = (params: Record<string, unknown>) => nav.navigate("AdminOrgs", params);

  return (
    <Screen
      title="Platform overview"
      subtitle="Agencies, subscriptions and revenue across BharatRailGo"
      testID="admin-dashboard"
      refreshing={dash.isRefetching}
      onRefresh={refresh}
      actions={<Button title="Refresh" variant="secondary" size="sm" onPress={refresh} testID="admin-dashboard-refresh" />}
    >
      {dash.error ? (
        <ErrorState message={apiErrorMessage(dash.error)} onRetry={() => dash.refetch()} />
      ) : !d || !o ? (
        <LoadingBlock rows={4} />
      ) : (
        <Col gap={20}>
          <Board
            title="Recurring revenue"
            testID="admin-revenue-board"
            right={<BoardText dim>{`${formatNumber(o.active)} PAID`}</BoardText>}
          >
            <Row gap={isPhone ? 16 : 40} wrap align="flex-end">
              <Col gap={6}>
                <BoardText dim size={12}>
                  MRR
                </BoardText>
                <FlapText testID="admin-mrr" text={formatMoney(d.mrr, { compact: true }).replace("₹", "RS ")} size={isPhone ? 18 : 24} />
                <BoardText dim size={12}>
                  {formatMoney(d.mrr)}
                </BoardText>
              </Col>
              <Col gap={6}>
                <BoardText dim size={12}>
                  ARR
                </BoardText>
                <FlapText testID="admin-arr" text={formatMoney(d.arr, { compact: true }).replace("₹", "RS ")} size={isPhone ? 18 : 24} />
                <BoardText dim size={12}>
                  {formatMoney(d.arr)}
                </BoardText>
              </Col>
            </Row>
          </Board>

          <View>
            <SectionHeader title="Agencies" />
            <Row wrap gap={12} align="stretch">
              <StatTile
                testID="admin-kpi-total"
                label="Total agencies"
                value={formatNumber(o.total)}
                icon={Building2}
                onPress={() => toOrgs({})}
              />
              <StatTile
                testID="admin-kpi-pending"
                label="Pending approval"
                value={formatNumber(o.pending)}
                icon={UserPlus}
                tone={o.pending > 0 ? "warning" : "default"}
                hint={o.pending > 0 ? "Review signups" : "All caught up"}
                onPress={() => toOrgs({ approvalStatus: "pending" })}
              />
              <StatTile
                testID="admin-kpi-trial"
                label="On trial"
                value={formatNumber(o.trial)}
                icon={Hourglass}
                onPress={() => toOrgs({ subscriptionStatus: "trial" })}
              />
              <StatTile
                testID="admin-kpi-active"
                label="Active paid"
                value={formatNumber(o.active)}
                icon={CheckCircle2}
                tone="success"
                onPress={() => toOrgs({ subscriptionStatus: "active" })}
              />
              <StatTile
                testID="admin-kpi-past-due"
                label="Past due"
                value={formatNumber(o.pastDue)}
                icon={AlertTriangle}
                tone={o.pastDue > 0 ? "warning" : "default"}
                onPress={() => toOrgs({ subscriptionStatus: "past_due" })}
              />
              <StatTile
                testID="admin-kpi-suspended"
                label="Suspended"
                value={formatNumber(o.suspended)}
                icon={Ban}
                tone={o.suspended > 0 ? "danger" : "default"}
                onPress={() => toOrgs({ status: "suspended" })}
              />
              <StatTile
                testID="admin-kpi-trials-ending"
                label="Trials ending ≤ 7 days"
                value={formatNumber(o.trialsEndingSoon)}
                icon={Clock}
                tone={o.trialsEndingSoon > 0 ? "warning" : "default"}
                hint="Follow up to convert"
                onPress={() => toOrgs({ subscriptionStatus: "trial" })}
              />
            </Row>
          </View>
        </Col>
      )}

      <View style={{ marginTop: 24 }}>
        <SectionHeader
          title="Needs attention · pending signups"
          action={
            <Button
              title="View all"
              variant="ghost"
              size="sm"
              testID="admin-pending-view-all"
              onPress={() => toOrgs({ approvalStatus: "pending" })}
            />
          }
        />
        {pending.error ? (
          <ErrorState message={apiErrorMessage(pending.error)} onRetry={() => pending.refetch()} />
        ) : pending.isLoading ? (
          <LoadingBlock rows={3} />
        ) : !pending.data?.items.length ? (
          <Card>
            <EmptyState icon={CheckCircle2} title="No pending signups" message="New agency signups waiting for approval appear here." />
          </Card>
        ) : (
          <Card padding={0} testID="admin-pending-list">
            {pending.data.items.map((org, i) => (
              <Row
                key={org.id}
                testID={`admin-pending-${org.id}`}
                gap={12}
                wrap
                justify="space-between"
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: t.c.border,
                }}
              >
                <Col gap={2} flex={1} style={{ minWidth: 200 }}>
                  <Text
                    variant="bodyStrong"
                    tone="accent"
                    testID={`admin-pending-open-${org.id}`}
                    onPress={() => nav.navigate("AdminOrgDetail", { id: org.id })}
                  >
                    {org.name}
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {[org.city, org.email, org.mobile].filter(Boolean).join(" · ") || "—"}
                  </Text>
                  <Text variant="caption" tone="faint">
                    {org.gstin ? <Text variant="caption" tone="faint" style={{ fontFamily: t.fonts.mono }}>{org.gstin} · </Text> : null}
                    Signed up {formatDate(org.createdAt)}
                  </Text>
                </Col>
                <Row gap={8}>
                  <Button
                    title="Review"
                    variant="secondary"
                    size="sm"
                    testID={`admin-pending-review-${org.id}`}
                    onPress={() => nav.navigate("AdminOrgDetail", { id: org.id })}
                  />
                  <Button
                    title="Approve"
                    size="sm"
                    icon={CheckCircle2}
                    loading={busyId === org.id}
                    disabled={!!busyId && busyId !== org.id}
                    testID={`admin-pending-approve-${org.id}`}
                    onPress={() => onApprove(org)}
                  />
                </Row>
              </Row>
            ))}
          </Card>
        )}
      </View>
    </Screen>
  );
}
