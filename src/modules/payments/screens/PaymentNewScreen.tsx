/**
 * Record a payment. Before saving, the party's open balance and a client-side
 * FIFO preview are shown; after saving, the real allocations from the server.
 */
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Plus } from "lucide-react-native";
import {
  Banner,
  Button,
  Card,
  Col,
  Combobox,
  DateField,
  Divider,
  Money,
  NumberField,
  Row,
  Screen,
  SectionHeader,
  SegmentedControl,
  Text,
  TextField,
  toast,
} from "@shared/ui";
import { useLayout, useTheme } from "@shared/useTheme";
import { useApiGet, useApiMutation } from "@shared/api/query";
import { apiErrorCode, apiErrorMessage } from "@shared/api/apiClient";
import { loadPartyOptions, type PartyLite } from "@shared/api/lookups";
import { isoDay, formatDate } from "@shared/lib/format";
import { useReadOnly } from "@shared/lib/permissions";
import { useAppNav, useParams } from "@navigation/useAppNav";
import { AllocationPreview } from "../components/AllocationPreview";
import { PAYMENT_INVALIDATE } from "../components/PaymentEditDialog";
import { consignmentLabel, useOpenConsignments } from "../lib";
import {
  PAYMENT_MODES,
  PAYMENT_MODE_LABEL,
  PAYMENT_MODE_OPTIONS,
  partyName,
  type ConsignmentLite,
  type Payment,
  type PaymentInput,
} from "../types";

const schema = z
  .object({
    party: z.string().min(1, "Pick the party who paid"),
    amount: z.number({ required_error: "Enter the amount", invalid_type_error: "Enter the amount" }).positive("Amount must be above zero"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
    mode: z.enum(PAYMENT_MODES),
    referenceNumber: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  });
type Form = z.infer<typeof schema>;

export function PaymentNewScreen() {
  const { isDesktop } = useLayout();
  const nav = useAppNav();
  const { partyId: paramPartyId } = useParams<{ partyId: string }>();
  const readOnly = useReadOnly();

  const [partyLabel, setPartyLabel] = useState<string | undefined>();
  const [expired, setExpired] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ payment: Payment; lookup: Map<string, ConsignmentLite> } | null>(null);

  const { control, handleSubmit, watch, setValue, reset, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      party: paramPartyId || "",
      amount: undefined as unknown as number,
      date: isoDay(),
      mode: "cash",
      referenceNumber: "",
      notes: "",
    },
  });

  // Pre-selected party from the route: fetch its name for the combobox.
  const preParty = useApiGet<PartyLite>(["parties", paramPartyId], paramPartyId ? `/parties/${paramPartyId}` : null);
  useEffect(() => {
    if (preParty.data && watch("party") === preParty.data.id) setPartyLabel(preParty.data.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preParty.data]);

  const party = watch("party");
  const amount = watch("amount");
  const mode = watch("mode");
  const open = useOpenConsignments(party || undefined);

  const create = useApiMutation<Payment, PaymentInput>("post", "/payments", { invalidate: PAYMENT_INVALIDATE });

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    setExpired(false);
    const lookup = new Map(open.items.map((c) => [c.id, c]));
    try {
      const payment = await create.mutateAsync({
        party: v.party,
        amount: v.amount,
        date: v.date,
        mode: v.mode,
        referenceNumber: v.mode === "cash" ? undefined : v.referenceNumber || undefined,
        notes: v.notes || undefined,
      });
      toast.success("Payment recorded");
      setSaved({ payment, lookup });
    } catch (err) {
      if (apiErrorCode(err) === "SUBSCRIPTION_EXPIRED") setExpired(true);
      setFormError(apiErrorMessage(err));
      toast.error(apiErrorMessage(err));
    }
  });

  const startAnother = () => {
    const keepParty = saved ? party : "";
    setSaved(null);
    reset({ party: keepParty, amount: undefined as unknown as number, date: isoDay(), mode: "cash", referenceNumber: "", notes: "" });
  };

  const expiredBanner =
    expired || readOnly ? (
      <Banner
        tone="danger"
        title="Subscription expired"
        message="Your account is read-only, so new payments cannot be saved. Renew your plan in Settings → Plan."
        action={<Button title="View plan" size="sm" variant="secondary" onPress={() => nav.navigate("Plan")} testID="payment-view-plan" />}
        testID="payment-subscription-expired"
      />
    ) : null;

  if (saved) {
    return (
      <Screen title="Payment recorded" back backTo="Payments" testID="payment-new-screen" maxWidth={820}>
        <SavedResult
          payment={saved.payment}
          lookup={saved.lookup}
          onOpen={() => nav.navigate("PaymentDetail", { id: saved.payment.id })}
          onAnother={startAnother}
          onConsignment={(id) => nav.navigate("BookingDetail", { id })}
        />
      </Screen>
    );
  }

  const formCard = (
    <Card>
      <Col gap={16}>
        <Controller
          control={control}
          name="party"
          render={({ field, fieldState }) => (
            <Combobox<string>
              label="Party"
              placeholder="Who paid?"
              valueLabel={partyLabel}
              selectedValue={field.value || null}
              loadOptions={loadPartyOptions}
              onPick={(o) => {
                field.onChange(o ? o.value : "");
                setPartyLabel(o?.label);
              }}
              error={fieldState.error?.message}
              testID="payment-party"
            />
          )}
        />
        <Controller
          control={control}
          name="amount"
          render={({ field, fieldState }) => (
            <Col gap={6}>
              <Text variant="label" tone="muted">
                Amount received (₹)
              </Text>
              <NumberField
                value={field.value}
                onChange={(n) => field.onChange(n as number)}
                placeholder="0"
                error={fieldState.error?.message}
                testID="payment-amount"
              />
              {field.value ? <Money value={field.value} variant="h1" tone="accent" /> : null}
            </Col>
          )}
        />
        <Controller
          control={control}
          name="date"
          render={({ field, fieldState }) => (
            <DateField label="Date" value={field.value} onChange={field.onChange} error={fieldState.error?.message} testID="payment-date" />
          )}
        />
        <Col gap={6}>
          <Text variant="label" tone="muted">
            Mode
          </Text>
          <SegmentedControl
            value={mode}
            options={PAYMENT_MODE_OPTIONS}
            onChange={(m) => setValue("mode", m)}
            testID="payment-mode"
          />
        </Col>
        {mode !== "cash" ? (
          <Controller
            control={control}
            name="referenceNumber"
            render={({ field }) => (
              <TextField
                label="Reference no."
                value={field.value}
                onChangeText={field.onChange}
                mono
                placeholder={mode === "cheque" ? "Cheque number" : mode === "upi" ? "UPI transaction ID" : "Reference"}
                testID="payment-reference"
              />
            )}
          />
        ) : null}
        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <TextField label="Notes" value={field.value} onChangeText={field.onChange} multiline testID="payment-notes" />
          )}
        />
        {formError ? (
          <Text tone="danger" testID="payment-error">
            {formError}
          </Text>
        ) : null}
        <Button
          title="Save payment"
          size="lg"
          onPress={onSubmit}
          loading={formState.isSubmitting || create.isPending}
          disabled={readOnly}
          fullWidth
          testID="payment-save"
        />
      </Col>
    </Card>
  );

  const previewCol = party ? (
    <AllocationPreview
      amount={amount}
      open={open.items}
      totalDue={open.totalDue}
      loading={open.isLoading}
      error={open.error}
      onRetry={open.refetch}
    />
  ) : (
    <Card tone="sunken" testID="payment-preview-empty">
      <Text tone="muted">Pick a party to see their open balance and how this payment will be split.</Text>
    </Card>
  );

  return (
    <Screen title="Record payment" back backTo="Payments" testID="payment-new-screen" maxWidth={1100}>
      <Col gap={16}>
        {expiredBanner}
        <Row gap={20} align="flex-start" wrap={!isDesktop} style={{ flexDirection: isDesktop ? "row" : "column" }}>
          <View style={{ flex: isDesktop ? 1 : undefined, width: isDesktop ? undefined : "100%" }}>{formCard}</View>
          <View style={{ flex: isDesktop ? 1 : undefined, width: isDesktop ? undefined : "100%", gap: 8 }}>
            <SectionHeader title="Allocation preview" />
            {previewCol}
          </View>
        </Row>
      </Col>
    </Screen>
  );
}

function SavedResult({
  payment,
  lookup,
  onOpen,
  onAnother,
  onConsignment,
}: {
  payment: Payment;
  lookup: Map<string, ConsignmentLite>;
  onOpen: () => void;
  onAnother: () => void;
  onConsignment: (id: string) => void;
}) {
  const t = useTheme();
  return (
    <Col gap={16} testID="payment-saved">
      <Card tone="accent">
        <Row gap={12} align="flex-start">
          <CheckCircle2 size={24} color={t.c.success} />
          <Col gap={4} flex={1}>
            <Text variant="h3">
              <Money value={payment.amount} variant="h3" /> from {partyName(payment.party)}
            </Text>
            <Text tone="muted">
              {formatDate(payment.date)} · {PAYMENT_MODE_LABEL[payment.mode] ?? payment.mode}
              {payment.referenceNumber ? ` · ${payment.referenceNumber}` : ""}
            </Text>
          </Col>
        </Row>
      </Card>

      <Card>
        <SectionHeader title="How it was allocated" />
        {payment.allocations.length === 0 ? (
          <Text tone="muted">No open bookings, so nothing was allocated.</Text>
        ) : (
          payment.allocations.map((a, i) => {
            const c = lookup.get(a.consignment);
            return (
              <Row
                key={a.consignment}
                justify="space-between"
                style={{ paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: t.c.border }}
              >
                <Text
                  tone="accent"
                  onPress={() => onConsignment(a.consignment)}
                  testID={`payment-saved-alloc-${a.consignment}`}
                  numberOfLines={1}
                  style={{ flex: 1 }}
                >
                  {c ? consignmentLabel(c) : `Booking …${a.consignment.slice(-6)}`}
                </Text>
                <Money value={a.amount} tone="success" />
              </Row>
            );
          })
        )}
        {payment.unallocatedAmount > 0 ? (
          <>
            <Divider style={{ marginVertical: 8 }} />
            <Row justify="space-between" testID="payment-saved-advance">
              <Text variant="bodyStrong">Kept as advance</Text>
              <Money value={payment.unallocatedAmount} variant="bodyStrong" tone="accent" />
            </Row>
          </>
        ) : null}
      </Card>

      <Row gap={8} wrap>
        <Button title="Open payment" onPress={onOpen} testID="payment-saved-open" />
        <Button title="Record another" icon={Plus} variant="secondary" onPress={onAnother} testID="payment-saved-another" />
      </Row>
    </Col>
  );
}
