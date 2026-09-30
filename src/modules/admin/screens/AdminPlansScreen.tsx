/** Subscription plans catalogue: list, create, edit. */
import React, { useState } from "react";
import { Plus, Tags } from "lucide-react-native";
import {
  Button,
  Col,
  DataList,
  EmptyState,
  Money,
  Row,
  Screen,
  StatusPill,
  Text,
  type Column,
} from "@shared/ui";
import { useTheme } from "@shared/useTheme";
import { apiErrorMessage } from "@shared/api/apiClient";
import { useAdminPlans, type Plan } from "../api";
import { limitLabel } from "../components/OrgBits";
import { PlanDialog } from "../components/PlanDialog";

export function AdminPlansScreen() {
  const t = useTheme();
  const plans = useAdminPlans();
  const [editing, setEditing] = useState<Plan | null>(null);
  const [open, setOpen] = useState(false);

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (p: Plan) => {
    setEditing(p);
    setOpen(true);
  };

  const rows = [...(plans.data ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.priceMonthly - b.priceMonthly,
  );
  const mono = { fontFamily: t.fonts.mono };

  const columns: Column<Plan>[] = [
    {
      key: "plan",
      title: "Plan",
      flex: 1.6,
      render: (p) => (
        <Col gap={2}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {p.name}
          </Text>
          <Text variant="caption" tone="faint" style={mono}>
            {p.code}
          </Text>
        </Col>
      ),
    },
    {
      key: "monthly",
      title: "Monthly",
      flex: 1,
      align: "right",
      render: (p) => <Money value={p.priceMonthly} />,
    },
    {
      key: "yearly",
      title: "Yearly",
      flex: 1,
      align: "right",
      render: (p) => <Money value={p.priceYearly} />,
    },
    {
      key: "limits",
      title: "Users · Branches · Bookings/mo",
      flex: 2,
      render: (p) => (
        <Text variant="caption" style={mono}>
          {limitLabel(p.limits.maxUsers)} · {limitLabel(p.limits.maxBranches)} ·{" "}
          {limitLabel(p.limits.maxBookingsPerMonth)}
        </Text>
      ),
    },
    {
      key: "flags",
      title: "Flags",
      flex: 2,
      render: (p) => (
        <Row gap={4} wrap>
          <StatusPill
            status={p.isActive ? "active" : "draft"}
            label={p.isActive ? "Active" : "Inactive"}
          />
          {p.isPublic ? (
            <StatusPill status="sent" label="Public" />
          ) : (
            <StatusPill status="draft" label="Hidden" />
          )}
          {p.isFeatured ? (
            <StatusPill status="pending" label="Featured" />
          ) : null}
          {p.isTrial ? <StatusPill status="trial" label="Trial" /> : null}
        </Row>
      ),
    },
    {
      key: "edit",
      title: "",
      flex: 0.7,
      align: "right",
      hideOnPhone: true,
      render: (p) => (
        <Button
          title="Edit"
          variant="ghost"
          size="sm"
          onPress={() => openEdit(p)}
          testID={`admin-plan-edit-${p.code}`}
        />
      ),
    },
  ];

  return (
    <Screen
      title="Plans"
      subtitle="Pricing and limits offered to agencies"
      testID="admin-plans"
      actions={
        <Button
          title="New plan"
          icon={Plus}
          onPress={openNew}
          testID="admin-plan-new"
        />
      }
    >
      <DataList
        testID="admin-plans-list"
        rows={plans.data ? rows : undefined}
        columns={columns}
        keyOf={(p) => p.id}
        onRowPress={openEdit}
        loading={plans.isLoading}
        error={
          plans.error ? { message: apiErrorMessage(plans.error) } : undefined
        }
        onRetry={() => plans.refetch()}
        phoneRight={(p) => <Money value={p.priceMonthly} />}
        empty={
          <EmptyState
            icon={Tags}
            title="No plans yet"
            message="Create a trial plan and at least one paid plan."
            action={
              <Button
                title="New plan"
                icon={Plus}
                onPress={openNew}
                testID="admin-plan-new-empty"
              />
            }
          />
        }
      />
      <PlanDialog
        plan={editing}
        visible={open}
        onClose={() => setOpen(false)}
      />
    </Screen>
  );
}
