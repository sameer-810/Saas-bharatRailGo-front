/**
 * Online billing (Razorpay): pay dialog, live payment status, autopay control
 * and billing history with GST invoices.
 *
 * Flow: owner picks a plan → POST /billing/checkout → the hosted Razorpay page
 * opens (new tab on web, browser on phones) → we poll /billing/checkouts/:id
 * until the webhook has marked it paid → plan and usage refresh.
 */
import React, { useEffect, useRef, useState } from "react";
import { Linking, Platform, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  CreditCard,
  FileText,
  Repeat,
} from "lucide-react-native";
import {
  Banner,
  Button,
  Card,
  Col,
  DataList,
  Dialog,
  Divider,
  IconButton,
  Money,
  Row,
  SegmentedControl,
  StatusPill,
  Text,
  confirm,
  toast,
  type Column,
} from "@shared/ui";
import { useTheme } from "@shared/useTheme";
import {
  apiClient,
  apiErrorCode,
  apiErrorMessage,
} from "@shared/api/apiClient";
import { useApiGet } from "@shared/api/query";
import { openPdf } from "@shared/api/files";
import { formatDate } from "@shared/lib/format";
import type { Subscription } from "@shared/store/useAuthStore";

export type Cycle = "monthly" | "yearly";
type Mode = "one_time" | "autopay";

interface Price {
  baseAmount: number;
  gstAmount: number;
  totalAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
}

interface Checkout {
  id: string;
  mode: Mode;
  planCode: string;
  billingCycle: Cycle;
  totalAmount: number;
  status: "created" | "authenticated" | "paid" | "expired" | "cancelled";
  shortUrl?: string;
  failedAttempts: number;
  lastFailureReason: string | null;
}

interface BillingInvoice {
  id: string;
  number: string;
  date: string;
  planName: string;
  billingCycle: Cycle;
  mode: Mode;
  periodStart: string;
  periodEnd: string;
  baseAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
}

export interface BillingSummary {
  enabled: boolean;
  provider: string;
  gstRate: number;
  subscription: Subscription & { autopay: boolean };
  plans: { code: string; name: string; monthly: Price; yearly: Price }[];
  checkouts: Checkout[];
  invoices: BillingInvoice[];
}

export function useBilling() {
  return useApiGet<BillingSummary>(["billing"], "/billing", undefined, {
    staleTime: 15_000,
  });
}

async function openCheckout(url: string) {
  if (Platform.OS === "web") {
    const w = window.open(url, "_blank");
    if (!w) window.location.href = url;
    return;
  }
  await Linking.openURL(url);
}

/** Poll a checkout until paid / closed; returns the live status. */
function useCheckoutPoll(checkoutId: string | null, onPaid: () => void) {
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const paidRef = useRef(false);
  useEffect(() => {
    paidRef.current = false;
    setCheckout(null);
    if (!checkoutId) return;
    let alive = true;
    const tick = async () => {
      try {
        const res = await apiClient.get(`/billing/checkouts/${checkoutId}`);
        if (!alive) return;
        const c = res.data.data as Checkout;
        setCheckout(c);
        if (c.status === "paid" && !paidRef.current) {
          paidRef.current = true;
          onPaid();
        }
      } catch {
        /* keep polling */
      }
    };
    tick();
    const h = setInterval(tick, 2500);
    return () => {
      alive = false;
      clearInterval(h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutId]);
  return checkout;
}

function PriceBreakdown({ price, gstRate }: { price: Price; gstRate: number }) {
  const line = (label: string, v: number, strong?: boolean) => (
    <Row justify="space-between">
      <Text
        variant={strong ? "bodyStrong" : "body"}
        tone={strong ? "default" : "muted"}
      >
        {label}
      </Text>
      <Money value={v} variant={strong ? "h3" : "money"} />
    </Row>
  );
  return (
    <Col gap={6} testID="pay-breakdown">
      {line("Plan price", price.baseAmount)}
      {price.igst ? line(`IGST ${gstRate}%`, price.igst) : null}
      {price.cgst ? line(`CGST ${gstRate / 2}%`, price.cgst) : null}
      {price.sgst ? line(`SGST ${gstRate / 2}%`, price.sgst) : null}
      <Divider />
      {line("Total", price.totalAmount, true)}
    </Col>
  );
}

/**
 * Pay for a plan. Opens the hosted checkout and waits for the webhook.
 * `resumeCheckoutId` re-attaches to a payment in progress (e.g. after the
 * Razorpay page redirects back to /settings/plan?checkout=…).
 */
export function PayDialog({
  visible,
  onClose,
  planCode,
  initialCycle,
  billing,
  resumeCheckoutId,
}: {
  visible: boolean;
  onClose: () => void;
  planCode: string | null;
  initialCycle: Cycle;
  billing: BillingSummary | undefined;
  resumeCheckoutId?: string | null;
}) {
  const t = useTheme();
  const qc = useQueryClient();
  const [cycle, setCycle] = useState<Cycle>(initialCycle);
  const [mode, setMode] = useState<Mode>("one_time");
  const [busy, setBusy] = useState(false);
  const [checkoutId, setCheckoutId] = useState<string | null>(
    resumeCheckoutId || null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setCycle(initialCycle);
      setError(null);
      setCheckoutId(resumeCheckoutId || null);
    }
  }, [visible, initialCycle, resumeCheckoutId]);

  const live = useCheckoutPoll(checkoutId, () => {
    toast.success("Payment received — your plan is active");
    qc.invalidateQueries({ queryKey: ["billing"] });
    qc.invalidateQueries({ queryKey: ["me"] });
  });

  const plan = billing?.plans.find(
    (p) => p.code === (live?.planCode || planCode),
  );
  const price = plan ? plan[live?.billingCycle || cycle] : null;
  const autopayOn = !!billing?.subscription.autopay;

  const start = async () => {
    if (!planCode) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.post("/billing/checkout", {
        planCode,
        billingCycle: cycle,
        mode,
      });
      const c = res.data.data as Checkout;
      setCheckoutId(c.id);
      if (c.shortUrl) await openCheckout(c.shortUrl);
    } catch (err) {
      setError(
        apiErrorCode(err) === "BILLING_DISABLED"
          ? "Online payment is not switched on yet. Please use “Request upgrade”."
          : apiErrorMessage(err),
      );
    } finally {
      setBusy(false);
    }
  };

  const paid = live?.status === "paid";
  const waiting =
    !!checkoutId &&
    !paid &&
    live?.status !== "expired" &&
    live?.status !== "cancelled";

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title={
        paid ? "Payment successful" : `${plan?.name || "Plan"} — pay online`
      }
      testID="pay-dialog"
      footer={
        paid ? (
          <Button title="Done" onPress={onClose} testID="pay-done" />
        ) : waiting ? (
          <>
            <Button
              title="Close"
              variant="secondary"
              onPress={onClose}
              testID="pay-close"
            />
            {live?.shortUrl ? (
              <Button
                title="Open payment page again"
                onPress={() => openCheckout(live.shortUrl!)}
                testID="pay-reopen"
              />
            ) : null}
          </>
        ) : (
          <>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={onClose}
              testID="pay-cancel"
            />
            <Button
              title={mode === "autopay" ? "Set up autopay" : "Pay now"}
              icon={mode === "autopay" ? Repeat : CreditCard}
              loading={busy}
              disabled={!price || (mode === "autopay" && autopayOn)}
              onPress={start}
              testID="pay-start"
            />
          </>
        )
      }
    >
      {paid ? (
        <Col gap={12} align="center" testID="pay-success">
          <CheckCircle2 size={44} color={t.c.success} />
          <Text variant="h2" align="center">
            {plan?.name} is active
          </Text>
          <Text tone="muted" align="center">
            Your GST invoice is in Billing history below.
          </Text>
        </Col>
      ) : waiting ? (
        <Col gap={12} testID="pay-waiting">
          <Banner
            tone="info"
            title="Complete the payment in the Razorpay window"
            message="This screen updates by itself as soon as the payment goes through."
          />
          {live && live.failedAttempts > 0 ? (
            <Banner
              testID="pay-failed"
              tone="danger"
              title="The last attempt failed"
              message={`${live.lastFailureReason || "Payment declined"}. You can try again on the same page.`}
            />
          ) : null}
          {price ? (
            <PriceBreakdown price={price} gstRate={billing?.gstRate ?? 18} />
          ) : null}
        </Col>
      ) : (
        <Col gap={14}>
          {error ? (
            <Banner tone="danger" title={error} testID="pay-error" />
          ) : null}
          <SegmentedControl<Cycle>
            testID="pay-cycle"
            value={cycle}
            onChange={setCycle}
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "yearly", label: "Yearly (2 months free)" },
            ]}
          />
          <SegmentedControl<Mode>
            testID="pay-mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "one_time", label: "Pay once" },
              { value: "autopay", label: "Autopay" },
            ]}
          />
          <Text variant="caption" tone="muted">
            {mode === "one_time"
              ? "Pay by UPI, card or netbanking for one period. Paying again before it ends adds another period."
              : autopayOn
                ? "Autopay is already on. Stop it first to switch plans."
                : "Approve a UPI autopay or card mandate once; it renews automatically. Stop any time."}
          </Text>
          {price ? (
            <PriceBreakdown price={price} gstRate={billing?.gstRate ?? 18} />
          ) : null}
        </Col>
      )}
    </Dialog>
  );
}

export function AutopayCard({ billing }: { billing: BillingSummary }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  if (!billing.subscription.autopay) return null;
  const stop = async () => {
    const ok = await confirm({
      title: "Stop autopay?",
      message: `You keep full access until ${formatDate(billing.subscription.endsAt)}. After that the app becomes read-only until you pay again.`,
      confirmLabel: "Stop autopay",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await apiClient.post("/billing/autopay/cancel", {});
      toast.success("Autopay stopped");
      qc.invalidateQueries({ queryKey: ["billing"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card testID="autopay-card">
      <Row justify="space-between" wrap gap={12}>
        <Row gap={10}>
          <Repeat size={20} />
          <Col gap={2}>
            <Text variant="bodyStrong">Autopay is on</Text>
            <Text variant="caption" tone="muted">
              Next renewal {formatDate(billing.subscription.endsAt)}
            </Text>
          </Col>
        </Row>
        <Button
          title="Stop autopay"
          variant="secondary"
          loading={busy}
          onPress={stop}
          testID="autopay-stop"
        />
      </Row>
    </Card>
  );
}

export function BillingHistory({ invoices }: { invoices: BillingInvoice[] }) {
  const columns: Column<BillingInvoice>[] = [
    {
      key: "number",
      title: "Invoice",
      flex: 1.3,
      render: (i) => <Text variant="mono">{i.number}</Text>,
    },
    {
      key: "date",
      title: "Date",
      render: (i) => <Text>{formatDate(i.date)}</Text>,
    },
    {
      key: "plan",
      title: "Plan",
      flex: 1.3,
      render: (i) => (
        <Text>
          {i.planName} · {i.billingCycle}
        </Text>
      ),
    },
    {
      key: "period",
      title: "Period",
      flex: 1.6,
      hideOnPhone: true,
      render: (i) => (
        <Text variant="caption" tone="muted">
          {formatDate(i.periodStart)} – {formatDate(i.periodEnd)}
        </Text>
      ),
    },
    {
      key: "total",
      title: "Paid",
      align: "right",
      render: (i) => <Money value={i.totalAmount} />,
    },
    {
      key: "pdf",
      title: "",
      flex: 0.4,
      align: "right",
      render: (i) => (
        <IconButton
          icon={FileText}
          label="Download invoice"
          testID={`billing-invoice-pdf-${i.id}`}
          onPress={() =>
            openPdf(
              `/billing/invoices/${i.id}/pdf`,
              `${i.number.replace(/\//g, "-")}.pdf`,
            ).catch((e) => toast.error(apiErrorMessage(e)))
          }
        />
      ),
    },
  ];
  return (
    <View testID="billing-history">
      <DataList
        rows={invoices}
        columns={columns}
        keyOf={(i) => i.id}
        phoneRight={(i) => <Money value={i.totalAmount} />}
        empty={
          <Card>
            <Text tone="muted">
              No payments yet. Invoices appear here after your first payment.
            </Text>
          </Card>
        }
      />
    </View>
  );
}

export function BillingStatusPill({ status }: { status: Checkout["status"] }) {
  return <StatusPill status={status === "created" ? "pending" : status} />;
}
