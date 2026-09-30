/** Assign plan / status / billing cycle / paid period to an organization. */
import React, { useEffect, useMemo, useState } from "react";
import {
  Banner,
  Button,
  Chip,
  Col,
  Dialog,
  NumberField,
  Row,
  SegmentedControl,
  Select,
  Text,
  toast,
} from "@shared/ui";
import { apiErrorMessage } from "@shared/api/apiClient";
import { formatDate, formatMoney, addDays } from "@shared/lib/format";
import {
  adminActions,
  useAdminMutation,
  useAdminPlans,
  type AdminOrgDetail,
  type BillingCycle,
  type SubscriptionPatch,
  type SubStatus,
} from "../api";

type EditableStatus = Exclude<SubStatus, "none">;
const STATUS_OPTIONS: { value: EditableStatus; label: string }[] = [
  { value: "trial", label: "Trial" },
  { value: "active", label: "Active (paid)" },
  { value: "past_due", label: "Past due" },
  { value: "cancelled", label: "Cancelled" },
];
const PERIODS = [30, 90, 180, 365];

export function ChangePlanDialog({
  org,
  visible,
  onClose,
}: {
  org: AdminOrgDetail;
  visible: boolean;
  onClose: () => void;
}) {
  const plans = useAdminPlans();
  const [planCode, setPlanCode] = useState<string | null>(null);
  const [status, setStatus] = useState<EditableStatus | null>(null);
  const [cycle, setCycle] = useState<"monthly" | "yearly" | "none">("monthly");
  const [periodDays, setPeriodDays] = useState<number | undefined>(30);
  const save = useAdminMutation((body: SubscriptionPatch) =>
    adminActions.updateSubscription(org.id, body),
  );

  useEffect(() => {
    if (!visible) return;
    const s = org.subscription;
    setPlanCode(s.planCode);
    setStatus(s.status === "none" ? "active" : s.status);
    setCycle(s.billingCycle ?? "monthly");
    setPeriodDays(s.billingCycle === "yearly" ? 365 : 30);
  }, [visible, org]);

  const planOptions = useMemo(
    () =>
      (plans.data ?? []).map((p) => ({
        value: p.code,
        label: `${p.name} (${p.code})${p.isActive ? "" : " · inactive"}`,
        hint: p.isTrial
          ? "Trial plan"
          : `${formatMoney(p.priceMonthly)}/mo · ${formatMoney(p.priceYearly)}/yr`,
      })),
    [plans.data],
  );

  const isPaid = status === "active" || status === "past_due";

  const submit = async () => {
    const body: SubscriptionPatch = {};
    if (planCode && planCode !== org.subscription.planCode)
      body.planCode = planCode;
    if (status) body.status = status;
    body.billingCycle = cycle === "none" ? null : (cycle as BillingCycle);
    if (isPaid && periodDays) {
      if (
        !Number.isInteger(periodDays) ||
        periodDays < 1 ||
        periodDays > 3660
      ) {
        toast.error("Period must be 1 to 3660 days");
        return;
      }
      body.periodDays = periodDays;
    }
    try {
      const r = await save.mutateAsync(body);
      toast.success(r.message || "Subscription updated");
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title="Change plan"
      testID="admin-change-plan-dialog"
      footer={
        <>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={onClose}
            testID="admin-change-plan-cancel"
          />
          <Button
            title="Save subscription"
            loading={save.isPending}
            onPress={submit}
            testID="admin-change-plan-submit"
          />
        </>
      }
    >
      {org.approvalStatus !== "approved" ? (
        <Banner
          tone="warning"
          title="Approve the agency first"
          message="Subscriptions can only be changed once approved."
        />
      ) : null}
      <Select
        testID="admin-change-plan-plan"
        label="Plan"
        value={planCode}
        options={planOptions}
        onChange={setPlanCode}
        placeholder={plans.isLoading ? "Loading plans…" : "Select plan"}
      />
      <Select<EditableStatus>
        testID="admin-change-plan-status"
        label="Status"
        value={status}
        options={STATUS_OPTIONS}
        onChange={setStatus}
      />
      <Col gap={6}>
        <Text variant="label" tone="muted">
          Billing cycle
        </Text>
        <SegmentedControl
          testID="admin-change-plan-cycle"
          value={cycle}
          onChange={(v) => {
            setCycle(v);
            if (v === "yearly") setPeriodDays(365);
            if (v === "monthly") setPeriodDays(30);
          }}
          options={[
            { value: "monthly", label: "Monthly" },
            { value: "yearly", label: "Yearly" },
            { value: "none", label: "None" },
          ]}
        />
      </Col>
      {isPaid ? (
        <Col gap={8}>
          <Text variant="label" tone="muted">
            Paid period from today
          </Text>
          <Row gap={6} wrap>
            {PERIODS.map((d) => (
              <Chip
                key={d}
                label={`${d} days`}
                selected={periodDays === d}
                onPress={() => setPeriodDays(d)}
                testID={`admin-change-plan-period-${d}`}
              />
            ))}
          </Row>
          <NumberField
            testID="admin-change-plan-period-days"
            label="Days"
            value={periodDays}
            onChange={(v) =>
              setPeriodDays(v == null ? undefined : Math.floor(v))
            }
            hint={
              periodDays
                ? `Period ends ${formatDate(addDays(new Date(), periodDays))}`
                : "Leave empty to keep the current end date"
            }
          />
        </Col>
      ) : status === "trial" ? (
        <Text variant="caption" tone="faint">
          Trial end date is unchanged. Use “Extend trial” to add days.
        </Text>
      ) : null}
    </Dialog>
  );
}
