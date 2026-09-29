/**
 * Plan & usage — current subscription, usage meters against plan limits, and
 * the public plan list for comparison. Owners pay online (Razorpay) when
 * billing is enabled; otherwise "Request upgrade" contacts support.
 */
import React, { useState } from "react";
import { Linking, View } from "react-native";
import { Check, Mail, MessageCircle } from "lucide-react-native";
import { useTheme } from "@shared/useTheme";
import {
  Banner,
  Button,
  Card,
  Col,
  EmptyState,
  ErrorState,
  KeyValue,
  LoadingBlock,
  Money,
  Row,
  Screen,
  SectionHeader,
  SegmentedControl,
  StatusPill,
  Text,
  toast,
} from "@shared/ui";
import { useApiGet } from "@shared/api/query";
import { apiErrorMessage } from "@shared/api/apiClient";
import { formatDate, formatNumber } from "@shared/lib/format";
import {
  useAuthStore,
  type Limits,
  type Subscription,
} from "@shared/store/useAuthStore";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP, type PublicPlan } from "../types";
import { CardTitle, UsageMeter, useSubscription } from "../components/common";
import {
  AutopayCard,
  BillingHistory,
  PayDialog,
  useBilling,
} from "../components/Billing";
import { useCan } from "@shared/lib/permissions";
import { useParams } from "@navigation/useAppNav";

type Cycle = "monthly" | "yearly";

const STATUS_LABEL: Record<Subscription["status"], string> = {
  none: "No plan",
  trial: "Free trial",
  active: "Active",
  past_due: "Payment due",
  cancelled: "Cancelled",
};

function limitText(v: number | null, noun: string) {
  if (v == null) return `Unlimited ${noun}`;
  const word = v === 1 ? noun.replace(/es$/, "").replace(/s$/, "") : noun;
  return `${formatNumber(v)} ${word}`;
}

/** Plan features minus the ones that just repeat the limits shown above them. */
function extraFeatures(features: string[]) {
  return features.filter((f) => !/\b(users?|branch(es)?|bookings?)\b/i.test(f));
}

function upgradeMessage(
  orgName: string | undefined,
  sub: Subscription | null,
  plan?: PublicPlan,
  cycle?: Cycle,
) {
  const lines = [
    `Hello, I'd like to ${plan ? `move to the ${plan.name} plan (${cycle})` : "upgrade my BharatRailGo plan"}.`,
    orgName ? `Agency: ${orgName}` : "",
    sub?.planName ? `Current plan: ${sub.planName}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

async function openLink(url: string) {
  try {
    const ok = await Linking.canOpenURL(url);
    if (!ok && !url.startsWith("http")) throw new Error("unsupported");
    await Linking.openURL(url);
  } catch {
    toast.error(`Could not open the link. Contact ${SUPPORT_EMAIL}`);
  }
}

function requestUpgrade(channel: "email" | "whatsapp", text: string) {
  if (channel === "email") {
    const subject = encodeURIComponent("Plan upgrade request");
    return openLink(
      `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${encodeURIComponent(text)}`,
    );
  }
  return openLink(
    `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(text)}`,
  );
}

function CurrentPlanCard({
  sub,
  onlinePayment,
}: {
  sub: Subscription;
  onlinePayment: boolean;
}) {
  const t = useTheme();
  const orgName = useAuthStore((s) => s.organization?.name);
  const days = sub.daysLeft;
  const endLabel =
    sub.state === "grace"
      ? "Grace ends"
      : sub.status === "trial"
        ? "Trial ends"
        : sub.status === "active"
          ? "Renews on"
          : "Ends on";
  const endValue = sub.state === "grace" ? sub.graceEndsAt : sub.endsAt;
  const text = upgradeMessage(orgName, sub);

  return (
    <Card testID="plan-current">
      <Row justify="space-between" align="flex-start" wrap gap={12}>
        <Col gap={6}>
          <Text variant="overline" tone="muted">
            Current plan
          </Text>
          <Text variant="h1" testID="plan-current-name">
            {sub.planName || "No plan"}
          </Text>
          <Row gap={8} wrap>
            <StatusPill status={sub.status} label={STATUS_LABEL[sub.status]} />
            {sub.state !== "ok" ? (
              <StatusPill
                status={sub.state}
                label={sub.state === "grace" ? "Grace period" : "Read-only"}
              />
            ) : null}
            {sub.billingCycle ? (
              <Text variant="caption" tone="muted">
                Billed {sub.billingCycle}
              </Text>
            ) : null}
          </Row>
        </Col>
        {days != null && sub.state === "ok" ? (
          <Col align="flex-end" gap={0}>
            <Text
              variant="display"
              style={{
                fontFamily: t.fonts.mono,
                color: days <= 5 ? t.c.warning : t.c.text,
              }}
              testID="plan-days-left"
            >
              {Math.max(days, 0)}
            </Text>
            <Text variant="caption" tone="muted">
              day{days === 1 ? "" : "s"} left
            </Text>
          </Col>
        ) : null}
      </Row>
      <View style={{ marginTop: 8 }}>
        <KeyValue
          items={[
            [endLabel, endValue ? formatDate(endValue) : "—"],
            [
              "Status",
              sub.state === "ok"
                ? "Working normally"
                : sub.state === "grace"
                  ? "Grace period"
                  : "Read-only",
            ],
          ]}
        />
      </View>
      {onlinePayment ? (
        <Text variant="caption" tone="muted" style={{ marginTop: 8 }}>
          Renew or change plan below — pay by UPI, card or netbanking, or switch
          on autopay. GST invoice included.
        </Text>
      ) : (
        <>
          <Row wrap gap={8} style={{ marginTop: 8 }}>
            <Button
              testID="plan-request-upgrade"
              title="Request upgrade"
              icon={Mail}
              onPress={() => requestUpgrade("email", text)}
            />
            {SUPPORT_WHATSAPP ? (
              <Button
                testID="plan-request-whatsapp"
                title="WhatsApp us"
                icon={MessageCircle}
                variant="secondary"
                onPress={() => requestUpgrade("whatsapp", text)}
              />
            ) : null}
          </Row>
          <Text variant="caption" tone="faint" style={{ marginTop: 8 }}>
            Online payment is not switched on yet — we upgrade your plan within
            one working day of your request.
          </Text>
        </>
      )}
    </Card>
  );
}

function StateBanner({ sub }: { sub: Subscription }) {
  if (sub.state === "expired" || sub.readOnly) {
    return (
      <Banner
        testID="plan-banner-readonly"
        tone="danger"
        title="The app is read-only"
        message="Your plan period and the grace days have ended. All data is safe — you can view and export it. Renew to add or edit bookings, parties and payments again."
      />
    );
  }
  if (sub.state === "grace") {
    return (
      <Banner
        testID="plan-banner-grace"
        tone="warning"
        title="Grace period — renew soon"
        message={`Your plan period is over, but everything keeps working${sub.graceEndsAt ? ` until ${formatDate(sub.graceEndsAt)}` : " for a few days"}. After that the app becomes read-only until you renew.`}
      />
    );
  }
  if (sub.status === "trial" && sub.daysLeft != null && sub.daysLeft <= 5) {
    return (
      <Banner
        testID="plan-banner-trial"
        tone="info"
        title={`Free trial ends in ${Math.max(sub.daysLeft, 0)} day${sub.daysLeft === 1 ? "" : "s"}`}
        message="Pick a plan below and request an upgrade to keep going without interruption."
      />
    );
  }
  return null;
}

function UsageCard({ sub }: { sub: Subscription }) {
  const limits: Limits = sub.limits || {
    maxUsers: null,
    maxBranches: null,
    maxBookingsPerMonth: null,
  };
  const usage = sub.usage || { users: 0, branches: 0, bookingsThisMonth: 0 };
  return (
    <Card testID="plan-usage">
      <CardTitle
        title="Usage"
        caption="Bookings count consignments and bilti created this calendar month."
      />
      <Col gap={16}>
        <UsageMeter
          testID="plan-usage-users"
          label="Active users"
          used={usage.users}
          limit={limits.maxUsers}
        />
        <UsageMeter
          testID="plan-usage-branches"
          label="Active branches"
          used={usage.branches}
          limit={limits.maxBranches}
        />
        <UsageMeter
          testID="plan-usage-bookings"
          label="Bookings this month"
          used={usage.bookingsThisMonth}
          limit={limits.maxBookingsPerMonth}
        />
      </Col>
    </Card>
  );
}

function PlanCard({
  plan,
  current,
  cycle,
  sub,
  onPay,
}: {
  plan: PublicPlan;
  current: boolean;
  cycle: Cycle;
  sub: Subscription | null;
  /** Online payment available for this user → pay / renew button. */
  onPay?: () => void;
}) {
  const t = useTheme();
  const orgName = useAuthStore((s) => s.organization?.name);
  const price = cycle === "monthly" ? plan.priceMonthly : plan.priceYearly;
  const monthlyEquivalent =
    cycle === "yearly" && plan.priceYearly ? plan.priceYearly / 12 : null;
  const saving =
    cycle === "yearly" && plan.priceMonthly > 0
      ? Math.round((1 - plan.priceYearly / (plan.priceMonthly * 12)) * 100)
      : 0;
  return (
    <View style={{ flexGrow: 1, flexBasis: 260, minWidth: 240 }}>
      <Card
        testID={`plan-card-${plan.code}`}
        tone={current ? "accent" : "default"}
        style={[
          { height: "100%" },
          (current || plan.isFeatured) && {
            borderColor: t.c.accent,
            borderWidth: current ? 2 : 1,
          },
        ]}
      >
        <Row justify="space-between" align="flex-start" gap={8}>
          <Text variant="h2">{plan.name}</Text>
          {current ? (
            <View
              testID={`plan-current-badge-${plan.code}`}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: t.radius.pill,
                backgroundColor: t.c.accent,
              }}
            >
              <Text variant="caption" weight="semibold" tone="inverse">
                Current
              </Text>
            </View>
          ) : plan.isFeatured ? (
            <Text variant="overline" tone="accent">
              Popular
            </Text>
          ) : null}
        </Row>
        {plan.description ? (
          <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
            {plan.description}
          </Text>
        ) : null}
        <Row gap={6} align="flex-end" style={{ marginTop: 14 }}>
          {price === 0 ? (
            <Text variant="h1">Free</Text>
          ) : (
            <>
              <Money value={price} variant="h1" />
              <Text variant="caption" tone="muted" style={{ marginBottom: 4 }}>
                /{cycle === "monthly" ? "month" : "year"}
              </Text>
            </>
          )}
        </Row>
        {monthlyEquivalent && price > 0 ? (
          <Row gap={4}>
            <Money
              value={monthlyEquivalent}
              variant="caption"
              tone="muted"
              compact
            />
            <Text variant="caption" tone="muted">
              /month{saving > 0 ? ` · save ${saving}%` : ""}
            </Text>
          </Row>
        ) : null}
        <Col gap={6} style={{ marginTop: 14 }}>
          {[
            limitText(plan.limits.maxUsers, "users"),
            limitText(plan.limits.maxBranches, "branches"),
            `${limitText(plan.limits.maxBookingsPerMonth, "bookings")} / month`,
            ...extraFeatures(plan.features),
          ].map((f) => (
            <Row key={f} gap={8} align="flex-start">
              <Check size={16} color={t.c.accent} style={{ marginTop: 3 }} />
              <Text style={{ flex: 1 }}>{f}</Text>
            </Row>
          ))}
        </Col>
        {onPay && !plan.isTrial ? (
          <View style={{ marginTop: 16 }}>
            <Button
              testID={`plan-pay-${plan.code}`}
              title={current ? `Renew ${plan.name}` : `Upgrade to ${plan.name}`}
              variant={current || plan.isFeatured ? "primary" : "secondary"}
              fullWidth
              onPress={onPay}
            />
          </View>
        ) : !current && !plan.isTrial ? (
          <View style={{ marginTop: 16 }}>
            <Button
              testID={`plan-choose-${plan.code}`}
              title={`Request ${plan.name}`}
              variant={plan.isFeatured ? "primary" : "secondary"}
              fullWidth
              onPress={() =>
                requestUpgrade(
                  "email",
                  upgradeMessage(orgName, sub, plan, cycle),
                )
              }
            />
          </View>
        ) : null}
      </Card>
    </View>
  );
}

export function PlanScreen() {
  const { sub, refetch, isLoading } = useSubscription();
  const plans = useApiGet<PublicPlan[]>(["plans"], "/plans", undefined, {
    staleTime: 5 * 60_000,
  });
  const [cycle, setCycle] = useState<Cycle>(
    sub?.billingCycle === "yearly" ? "yearly" : "monthly",
  );
  const billing = useBilling();
  const canPay = useCan("billing.manage") && !!billing.data?.enabled;
  const params = useParams<{ checkout: string }>();
  const [pay, setPay] = useState<{
    planCode: string | null;
    resume: string | null;
  } | null>(null);

  // Returning from the Razorpay page: /settings/plan?checkout=<id> → show its live status.
  React.useEffect(() => {
    if (params.checkout)
      setPay({ planCode: null, resume: String(params.checkout) });
  }, [params.checkout]);

  const sorted = [...(plans.data || [])].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.priceMonthly - b.priceMonthly,
  );

  return (
    <Screen
      title="Plan & usage"
      back
      backTo="Settings"
      refreshing={plans.isRefetching}
      onRefresh={() => {
        refetch();
        plans.refetch();
      }}
      testID="plan-screen"
    >
      <Col gap={16}>
        {!sub ? (
          isLoading ? (
            <LoadingBlock rows={3} />
          ) : (
            <ErrorState
              message="Could not load your subscription."
              onRetry={refetch}
            />
          )
        ) : (
          <>
            <StateBanner sub={sub} />
            <Row wrap gap={16} align="stretch">
              <View style={{ flexGrow: 1, flexBasis: 340 }}>
                <CurrentPlanCard sub={sub} onlinePayment={canPay} />
              </View>
              <View style={{ flexGrow: 1, flexBasis: 340 }}>
                <UsageCard sub={sub} />
              </View>
            </Row>
          </>
        )}

        <Col gap={0}>
          <SectionHeader
            title="Compare plans"
            action={
              <SegmentedControl<Cycle>
                testID="plan-cycle"
                value={cycle}
                onChange={setCycle}
                options={[
                  { value: "monthly", label: "Monthly" },
                  { value: "yearly", label: "Yearly" },
                ]}
              />
            }
          />
          {plans.isLoading ? (
            <LoadingBlock rows={3} />
          ) : plans.error ? (
            <ErrorState
              message={apiErrorMessage(plans.error)}
              onRetry={() => plans.refetch()}
            />
          ) : !sorted.length ? (
            <EmptyState
              title="No plans published yet"
              message={`Contact ${SUPPORT_EMAIL} for pricing.`}
            />
          ) : (
            <Row wrap gap={12} align="stretch" testID="plan-list">
              {sorted.map((p) => (
                <PlanCard
                  key={p.id}
                  plan={p}
                  cycle={cycle}
                  sub={sub}
                  current={!!sub?.planCode && sub.planCode === p.code}
                  onPay={
                    canPay
                      ? () => setPay({ planCode: p.code, resume: null })
                      : undefined
                  }
                />
              ))}
            </Row>
          )}
        </Col>

        {billing.data ? (
          <Col gap={0}>
            <AutopayCard billing={billing.data} />
            <SectionHeader title="Billing history" />
            <BillingHistory invoices={billing.data.invoices} />
          </Col>
        ) : null}
      </Col>
      <PayDialog
        visible={!!pay}
        onClose={() => {
          setPay(null);
          refetch();
          billing.refetch();
        }}
        planCode={pay?.planCode ?? null}
        resumeCheckoutId={pay?.resume ?? null}
        initialCycle={cycle}
        billing={billing.data}
      />
    </Screen>
  );
}
