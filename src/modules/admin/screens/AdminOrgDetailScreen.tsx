/** One agency: profile, users, subscription, limits override, actions and audit trail. */
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import {
  Ban,
  CheckCircle2,
  LogOut,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react-native";
import {
  Banner,
  Button,
  Card,
  Chip,
  Col,
  DataList,
  Dialog,
  Divider,
  EmptyState,
  ErrorState,
  KeyValue,
  LoadingBlock,
  NumberField,
  Row,
  Screen,
  SectionHeader,
  StatusPill,
  Text,
  TextField,
  confirm,
  humanize,
  toast,
  type Column,
} from "@shared/ui";
import { useTheme } from "@shared/useTheme";
import { apiErrorMessage } from "@shared/api/apiClient";
import { formatDate, formatDateTime } from "@shared/lib/format";
import { useAdminNav, useParams } from "@navigation/useAppNav";
import {
  adminActions,
  useAdminAudit,
  useAdminMutation,
  useAdminOrg,
  useAdminPlans,
  type AdminOrgDetail,
  type AdminOrgUser,
  type Limits,
} from "../api";
import { OrgPills, UsageMeter, limitLabel } from "../components/OrgBits";
import { ReasonDialog } from "../components/ReasonDialog";
import { ChangePlanDialog } from "../components/ChangePlanDialog";
import { AuditList } from "../components/AuditList";

export function AdminOrgDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const org = useAdminOrg(id);

  if (!id) {
    return (
      <Screen title="Agency" back backTo="AdminOrgs">
        <EmptyState title="No agency selected" />
      </Screen>
    );
  }
  if (org.error) {
    return (
      <Screen title="Agency" back backTo="AdminOrgs" testID="admin-org-detail">
        <ErrorState
          message={apiErrorMessage(org.error)}
          onRetry={() => org.refetch()}
        />
      </Screen>
    );
  }
  if (!org.data) {
    return (
      <Screen title="Agency" back backTo="AdminOrgs" testID="admin-org-detail">
        <LoadingBlock rows={6} />
      </Screen>
    );
  }
  return (
    <OrgDetail
      org={org.data}
      refreshing={org.isRefetching}
      onRefresh={() => org.refetch()}
    />
  );
}

function OrgDetail({
  org,
  refreshing,
  onRefresh,
}: {
  org: AdminOrgDetail;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const t = useTheme();
  const [dialog, setDialog] = useState<null | "reject" | "suspend" | "plan">(
    null,
  );
  const [auditPage, setAuditPage] = useState(1);
  const audit = useAdminAudit({
    organization: org.id,
    page: auditPage,
    limit: 10,
  });

  const approve = useAdminMutation(() => adminActions.approve(org.id));
  const reject = useAdminMutation((reason: string) =>
    adminActions.reject(org.id, reason),
  );
  const suspend = useAdminMutation((reason: string) =>
    adminActions.suspend(org.id, reason),
  );
  const reactivate = useAdminMutation(() => adminActions.reactivate(org.id));
  const revoke = useAdminMutation(() => adminActions.revokeSessions(org.id));
  const extend = useAdminMutation((days: number) =>
    adminActions.updateSubscription(org.id, { extendTrialDays: days }),
  );

  const run = async <R,>(
    p: Promise<{ message?: string; data: R }>,
    fallback: (d: R) => string,
  ) => {
    try {
      const r = await p;
      toast.success(r.message || fallback(r.data));
      return true;
    } catch (err) {
      toast.error(apiErrorMessage(err));
      return false;
    }
  };

  const onApprove = async () => {
    const ok = await confirm({
      title: `Approve ${org.name}?`,
      message: "The agency can sign in and a free trial starts today.",
      confirmLabel: "Approve",
    });
    if (ok)
      await run(
        approve.mutateAsync(undefined),
        () => "Approved — trial started",
      );
  };
  const onReactivate = async () => {
    const ok = await confirm({
      title: `Reactivate ${org.name}?`,
      message: "Users can sign in again.",
      confirmLabel: "Reactivate",
    });
    if (ok) await run(reactivate.mutateAsync(undefined), () => "Reactivated");
  };
  const onRevoke = async () => {
    const ok = await confirm({
      title: "Sign out every user?",
      message: `All ${org.users.length} users of ${org.name} will be signed out on every device.`,
      confirmLabel: "Revoke sessions",
      danger: true,
    });
    if (ok)
      await run(
        revoke.mutateAsync(undefined),
        (d) => `${d.revoked} session${d.revoked === 1 ? "" : "s"} revoked`,
      );
  };
  const onExtend = async (days: number) => {
    const ok = await confirm({
      title: `Extend trial by ${days} days?`,
      message:
        "Sets the subscription to trial and pushes the trial end date forward.",
      confirmLabel: `Add ${days} days`,
    });
    if (ok)
      await run(
        extend.mutateAsync(days),
        () => `Trial extended by ${days} days`,
      );
  };

  const pending = org.approvalStatus === "pending";
  const approved = org.approvalStatus === "approved";
  const suspended = org.status === "suspended";
  const sub = org.subscription;

  const headerActions = (
    <>
      {pending ? (
        <>
          <Button
            title="Approve"
            icon={CheckCircle2}
            onPress={onApprove}
            loading={approve.isPending}
            testID="admin-org-approve"
          />
          <Button
            title="Reject"
            icon={XCircle}
            variant="danger"
            onPress={() => setDialog("reject")}
            testID="admin-org-reject"
          />
        </>
      ) : null}
      {approved && !suspended ? (
        <Button
          title="Change plan"
          variant="secondary"
          onPress={() => setDialog("plan")}
          testID="admin-org-change-plan"
        />
      ) : null}
    </>
  );

  const userColumns: Column<AdminOrgUser>[] = [
    {
      key: "name",
      title: "Name",
      flex: 1.4,
      render: (u) => (
        <Row gap={6}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {u.name}
          </Text>
          {org.owner?.id === u.id ? (
            <StatusPill status="info" label="Owner" />
          ) : null}
        </Row>
      ),
    },
    {
      key: "email",
      title: "Email",
      flex: 1.8,
      render: (u) => (
        <Text variant="caption" numberOfLines={1}>
          {u.email}
        </Text>
      ),
    },
    {
      key: "role",
      title: "Role",
      flex: 1,
      render: (u) => <Text variant="caption">{humanize(u.role)}</Text>,
    },
    {
      key: "active",
      title: "Status",
      flex: 0.8,
      render: (u) => (
        <StatusPill
          status={u.isActive ? "active" : "draft"}
          label={u.isActive ? "Active" : "Inactive"}
        />
      ),
    },
    {
      key: "login",
      title: "Last login",
      flex: 1,
      align: "right",
      render: (u) => (
        <Text variant="caption" tone="muted">
          {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}
        </Text>
      ),
    },
  ];

  return (
    <Screen
      title={org.name}
      subtitle={`${org.slug} · joined ${formatDate(org.createdAt)}`}
      back
      backTo="AdminOrgs"
      actions={headerActions}
      refreshing={refreshing}
      onRefresh={onRefresh}
      testID="admin-org-detail"
    >
      <Col gap={20}>
        <Row gap={8} wrap testID="admin-org-pills">
          <OrgPills org={org} />
          {approved ? (
            <StatusPill
              status={sub.status === "none" ? "draft" : sub.status}
              label={`Sub: ${humanize(sub.status)}`}
            />
          ) : null}
          {approved && sub.state !== "ok" ? (
            <StatusPill status={sub.state} />
          ) : null}
        </Row>

        {org.approvalStatus === "rejected" ? (
          <Banner
            tone="danger"
            title="Signup rejected"
            message={org.rejectionReason || undefined}
            testID="admin-org-rejected-banner"
          />
        ) : null}
        {suspended ? (
          <Banner
            tone="danger"
            title="Agency suspended — users cannot sign in"
            message={org.suspendedReason || undefined}
            testID="admin-org-suspended-banner"
          />
        ) : null}
        {org.deletion?.requestedAt ? <DeletionCard org={org} /> : null}
        {pending ? (
          <Banner
            tone="warning"
            title="Waiting for approval"
            message="Review the details below, then approve or reject this signup."
          />
        ) : null}

        <Card>
          <SectionHeader title="Profile" />
          <KeyValue
            items={[
              ["Email", org.email || "—"],
              [
                "Mobile",
                org.mobile ? (
                  <Text style={{ fontFamily: t.fonts.mono }}>{org.mobile}</Text>
                ) : (
                  "—"
                ),
              ],
              ["City", org.city || "—"],
              [
                "GSTIN",
                org.gstin ? (
                  <Text style={{ fontFamily: t.fonts.mono }}>{org.gstin}</Text>
                ) : (
                  "—"
                ),
              ],
              [
                "Owner",
                org.owner ? `${org.owner.name} · ${org.owner.email}` : "—",
              ],
              ["Approved", org.approvedAt ? formatDate(org.approvedAt) : "—"],
              [
                "Terms accepted",
                org.consent
                  ? `${formatDateTime(org.consent.acceptedAt)} (v${org.consent.termsVersion})`
                  : "Not recorded",
              ],
            ]}
          />
        </Card>

        <View>
          <SectionHeader title={`Users (${org.users.length})`} />
          <DataList
            testID="admin-org-users"
            rows={org.users}
            columns={userColumns}
            keyOf={(u) => u.id}
            empty={
              <Card>
                <EmptyState title="No users" />
              </Card>
            }
          />
        </View>

        <Card testID="admin-org-subscription">
          <SectionHeader
            title="Subscription"
            action={
              approved ? (
                <Button
                  title="Change plan"
                  variant="ghost"
                  size="sm"
                  onPress={() => setDialog("plan")}
                  testID="admin-org-sub-change-plan"
                />
              ) : undefined
            }
          />
          {!approved ? (
            <Text tone="muted">
              No subscription until the agency is approved.
            </Text>
          ) : (
            <Col gap={16}>
              <KeyValue
                items={[
                  [
                    "Plan",
                    <Text key="p">
                      {sub.planName || "—"}{" "}
                      {sub.planCode ? (
                        <Text tone="faint" style={{ fontFamily: t.fonts.mono }}>
                          ({sub.planCode})
                        </Text>
                      ) : null}
                    </Text>,
                  ],
                  [
                    "Status",
                    <StatusPill
                      key="s"
                      status={sub.status === "none" ? "draft" : sub.status}
                    />,
                  ],
                  [
                    "State",
                    <StatusPill
                      key="st"
                      status={sub.state}
                      label={
                        sub.readOnly
                          ? "Expired · read-only"
                          : humanize(sub.state)
                      }
                    />,
                  ],
                  [
                    "Billing cycle",
                    sub.billingCycle ? humanize(sub.billingCycle) : "—",
                  ],
                  ["Ends", sub.endsAt ? formatDate(sub.endsAt) : "No end date"],
                  [
                    "Grace ends",
                    sub.graceEndsAt ? formatDate(sub.graceEndsAt) : "—",
                  ],
                  [
                    "Days left",
                    <Text
                      key="d"
                      tone={
                        sub.daysLeft != null && sub.daysLeft <= 0
                          ? "danger"
                          : sub.daysLeft != null && sub.daysLeft <= 7
                            ? "warning"
                            : "default"
                      }
                      style={{ fontFamily: t.fonts.mono }}
                    >
                      {sub.daysLeft == null ? "∞" : String(sub.daysLeft)}
                    </Text>,
                  ],
                ]}
              />
              <Divider />
              <Row gap={20} wrap align="flex-start">
                <UsageMeter
                  testID="admin-usage-users"
                  label="Active users"
                  used={sub.usage.users}
                  limit={sub.limits.maxUsers}
                />
                <UsageMeter
                  testID="admin-usage-branches"
                  label="Active branches"
                  used={sub.usage.branches}
                  limit={sub.limits.maxBranches}
                />
                <UsageMeter
                  testID="admin-usage-bookings"
                  label="Bookings this month"
                  used={sub.usage.bookingsThisMonth}
                  limit={sub.limits.maxBookingsPerMonth}
                />
              </Row>
              <Divider />
              <Row gap={8} wrap>
                <Text variant="label" tone="muted">
                  Extend trial
                </Text>
                {[7, 14, 30].map((d) => (
                  <Chip
                    key={d}
                    label={`+${d} days`}
                    onPress={() => onExtend(d)}
                    testID={`admin-org-extend-${d}`}
                  />
                ))}
              </Row>
            </Col>
          )}
        </Card>

        <LimitsCard org={org} />

        {!pending ? (
          <Card testID="admin-org-actions">
            <SectionHeader title="Access controls" />
            <Col gap={12}>
              <Row justify="space-between" gap={12} wrap>
                <Col gap={2} flex={1} style={{ minWidth: 220 }}>
                  <Text variant="bodyStrong">
                    {suspended ? "Reactivate agency" : "Suspend agency"}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {suspended
                      ? "Lets users sign in again. The subscription is unchanged."
                      : "Blocks sign-in and signs out every user. Data is kept."}
                  </Text>
                </Col>
                {suspended ? (
                  <Button
                    title="Reactivate"
                    icon={RotateCcw}
                    onPress={onReactivate}
                    loading={reactivate.isPending}
                    testID="admin-org-reactivate"
                  />
                ) : (
                  <Button
                    title="Suspend"
                    icon={Ban}
                    variant="danger"
                    onPress={() => setDialog("suspend")}
                    testID="admin-org-suspend"
                  />
                )}
              </Row>
              <Divider />
              <Row justify="space-between" gap={12} wrap>
                <Col gap={2} flex={1} style={{ minWidth: 220 }}>
                  <Text variant="bodyStrong">Revoke all sessions</Text>
                  <Text variant="caption" tone="muted">
                    Signs every user out on every device. They can sign in
                    again.
                  </Text>
                </Col>
                <Button
                  title="Revoke sessions"
                  icon={LogOut}
                  variant="secondary"
                  onPress={onRevoke}
                  loading={revoke.isPending}
                  testID="admin-org-revoke-sessions"
                />
              </Row>
            </Col>
          </Card>
        ) : null}

        <View>
          <SectionHeader title="Audit trail" />
          <AuditList
            testID="admin-org-audit"
            rows={audit.data?.items}
            loading={audit.isLoading}
            error={
              audit.error
                ? { message: apiErrorMessage(audit.error) }
                : undefined
            }
            onRetry={() => audit.refetch()}
            paging={audit.data?.meta}
            onPage={setAuditPage}
            showOrg={false}
          />
        </View>
      </Col>

      <ReasonDialog
        testID="admin-reject-dialog"
        visible={dialog === "reject"}
        title={`Reject ${org.name}?`}
        message="The signup is refused and any open sessions are revoked."
        confirmLabel="Reject signup"
        loading={reject.isPending}
        onClose={() => setDialog(null)}
        onSubmit={async (reason) => {
          if (await run(reject.mutateAsync(reason), () => "Signup rejected"))
            setDialog(null);
        }}
      />
      <ReasonDialog
        testID="admin-suspend-dialog"
        visible={dialog === "suspend"}
        title={`Suspend ${org.name}?`}
        message="Every user is signed out and blocked until you reactivate the agency."
        confirmLabel="Suspend agency"
        loading={suspend.isPending}
        onClose={() => setDialog(null)}
        onSubmit={async (reason) => {
          if (await run(suspend.mutateAsync(reason), () => "Agency suspended"))
            setDialog(null);
        }}
      />
      {approved ? (
        <ChangePlanDialog
          org={org}
          visible={dialog === "plan"}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </Screen>
  );
}

/** Per-org limit overrides. Empty field = use the plan's limit (sent as null). */
function LimitsCard({ org }: { org: AdminOrgDetail }) {
  const plans = useAdminPlans();
  const plan = plans.data?.find((p) => p.code === org.subscription.planCode);
  const [vals, setVals] = useState<
    Partial<Record<keyof Limits, number | undefined>>
  >({});
  const save = useAdminMutation((body: Limits) =>
    adminActions.updateLimits(org.id, body),
  );

  useEffect(() => {
    setVals({
      maxUsers: org.limitsOverride.maxUsers ?? undefined,
      maxBranches: org.limitsOverride.maxBranches ?? undefined,
      maxBookingsPerMonth: org.limitsOverride.maxBookingsPerMonth ?? undefined,
    });
  }, [
    org.limitsOverride.maxUsers,
    org.limitsOverride.maxBranches,
    org.limitsOverride.maxBookingsPerMonth,
  ]);

  const fields: { key: keyof Limits; label: string }[] = [
    { key: "maxUsers", label: "Max users" },
    { key: "maxBranches", label: "Max branches" },
    { key: "maxBookingsPerMonth", label: "Max bookings / month" },
  ];

  const toNull = (v: number | undefined) => (v == null ? null : Math.floor(v));
  const dirty = fields.some(
    (f) => toNull(vals[f.key]) !== (org.limitsOverride[f.key] ?? null),
  );

  const submit = async () => {
    const body: Limits = {
      maxUsers: toNull(vals.maxUsers),
      maxBranches: toNull(vals.maxBranches),
      maxBookingsPerMonth: toNull(vals.maxBookingsPerMonth),
    };
    try {
      const r = await save.mutateAsync(body);
      toast.success(r.message || "Limits updated");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <Card testID="admin-org-limits">
      <SectionHeader title="Limit overrides" />
      <Text variant="caption" tone="muted" style={{ marginBottom: 12 }}>
        Leave a field empty to use the plan limit. Overrides win over the plan.
      </Text>
      <Row gap={12} wrap align="flex-start">
        {fields.map((f) => (
          <View key={f.key} style={{ flexGrow: 1, flexBasis: 180 }}>
            <NumberField
              testID={`admin-limits-${f.key}`}
              label={f.label}
              value={vals[f.key]}
              onChange={(v) => setVals((s) => ({ ...s, [f.key]: v }))}
              placeholder="Plan default"
              hint={
                plan
                  ? `Plan: ${limitLabel(plan.limits[f.key])}`
                  : "Plan default"
              }
            />
          </View>
        ))}
      </Row>
      <Row justify="flex-end" gap={8} style={{ marginTop: 12 }}>
        <Button
          title="Clear overrides"
          variant="ghost"
          size="sm"
          testID="admin-limits-clear"
          onPress={() => setVals({})}
        />
        <Button
          title="Save limits"
          size="sm"
          loading={save.isPending}
          disabled={!dirty}
          onPress={submit}
          testID="admin-limits-save"
        />
      </Row>
    </Card>
  );
}

/**
 * The owner asked to close the account. Purge unlocks after the grace period and
 * needs the slug typed back — it deletes every row of the agency, irreversibly.
 */
function DeletionCard({ org }: { org: AdminOrgDetail }) {
  const nav = useAdminNav();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const purge = useAdminMutation((slug: string) =>
    adminActions.purge(org.id, slug),
  );
  const d = org.deletion;
  const allowedFrom = d.purgeAllowedFrom ? new Date(d.purgeAllowedFrom) : null;
  const [openedAt] = useState(() => Date.now());
  const canPurge = !!allowedFrom && allowedFrom.getTime() <= openedAt;

  const onPurge = async () => {
    try {
      const r = await purge.mutateAsync(typed.trim());
      const rows = Object.values(r.data.deleted).reduce((a, n) => a + n, 0);
      toast.success(`${org.name} purged — ${rows} records deleted`);
      setOpen(false);
      nav.navigate("AdminOrgs");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <>
      <Banner
        testID="admin-org-deletion-banner"
        tone="danger"
        title={`Owner asked to delete this account on ${formatDate(d.requestedAt)}`}
        message={`${d.reason ? `Reason: ${d.reason}. ` : ""}${
          canPurge
            ? "The grace period is over — the agency's data can now be purged."
            : `Purge unlocks on ${formatDate(d.purgeAllowedFrom)} (the owner can cancel until then).`
        }`}
        action={
          <Button
            testID="admin-org-purge"
            title="Purge data"
            icon={Trash2}
            variant="danger"
            size="sm"
            disabled={!canPurge}
            onPress={() => setOpen(true)}
          />
        }
      />
      <Dialog
        visible={open}
        onClose={() => setOpen(false)}
        title={`Purge ${org.name}?`}
        testID="admin-purge-dialog"
        footer={
          <Row gap={8} justify="flex-end">
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => setOpen(false)}
            />
            <Button
              testID="admin-purge-confirm"
              title="Delete everything"
              variant="danger"
              loading={purge.isPending}
              disabled={typed.trim() !== org.slug}
              onPress={onPurge}
            />
          </Row>
        }
      >
        <Col gap={12}>
          <Text tone="muted">
            Every booking, bilti, bill, party, payment, user, branch and log
            entry of this agency is permanently deleted. Your GST invoices and
            payment records for their subscription are kept. This cannot be
            undone.
          </Text>
          <TextField
            testID="admin-purge-slug"
            label={`Type the slug "${org.slug}" to confirm`}
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="none"
            mono
          />
        </Col>
      </Dialog>
    </>
  );
}
