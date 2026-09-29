/**
 * Booking (consignment) form — shared by BookingNew and BookingEdit.
 * Schema mirrors bharatrailgo-back consignment.validation.js. Edit uses PATCH and
 * never sends date / party (the update schema omits them).
 */
import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Calculator, Save } from "lucide-react-native";
import {
  Banner,
  Button,
  Card,
  Chip,
  Col,
  Combobox,
  DateField,
  Divider,
  Money,
  NumberField,
  Row,
  SectionHeader,
  Select,
  Text,
  TextField,
  Toggle,
  toast,
} from "@shared/ui";
import { useLayout, useTheme } from "@shared/useTheme";
import { useApiMutation } from "@shared/api/query";
import { apiClient, apiErrorCode, apiErrorMessage, type Envelope } from "@shared/api/apiClient";
import {
  loadPartyOptions,
  loadStationOptions,
  useBranches,
  useBusinessProfile,
  type PartyLite,
} from "@shared/api/lookups";
import { useReadOnly } from "@shared/lib/permissions";
import { formatDate, formatMoney, isoDay } from "@shared/lib/format";
import { useBranchStore } from "@shared/store/useBranchStore";
import { useAppNav } from "@navigation/useAppNav";
import { FormGrid } from "./FormGrid";
import {
  CONSIGNMENT_TYPES,
  PAYMENT_MODES,
  PAYMENT_STATUS,
  partyId as partyIdOf,
  partyName as partyNameOf,
  paymentModeOptions,
  paymentStatusOptions,
  typeOptions,
  type BookingPrefill,
  type Consignment,
  type Quote,
} from "../lib/types";

const optNum = z.number({ invalid_type_error: "Enter a number" }).min(0, "Cannot be negative").optional();
const optStr = z.string().trim().optional();

const schema = z
  .object({
    date: z.string().trim().min(1, "Date is required"),
    party: z.string().min(1, "Pick a party"),
    type: z.enum(CONSIGNMENT_TYPES, { errorMap: () => ({ message: "Pick a booking type" }) }),
    destinationStation: z.string().trim().min(1, "Destination station is required"),
    originStation: optStr,
    packages: z
      .number({ required_error: "Enter packages", invalid_type_error: "Enter packages" })
      .int("Whole packages only")
      .min(1, "At least 1 package"),
    actualWeight: optNum,
    chargeableWeight: optNum,
    contents: optStr,
    agentName: optStr,
    trainNumber: optStr,
    bogieNumber: optStr,
    railwayReceiptNumber: optStr,
    freightAmount: z
      .number({ required_error: "Freight amount required", invalid_type_error: "Freight amount required" })
      .min(0, "Cannot be negative"),
    reimbursementAmount: optNum,
    hamaliCharges: optNum,
    otherCharges: optNum,
    paymentMode: z.enum(PAYMENT_MODES, { errorMap: () => ({ message: "Pick a payment mode" }) }),
    directPaid: optNum,
    paymentReceiver: z.string().trim().max(60, "At most 60 characters").optional(),
    isLease: z.boolean(),
    isBooking: z.boolean(),
    notes: optStr,
    paymentStatus: z.enum(PAYMENT_STATUS).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.chargeableWeight && !v.actualWeight) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["chargeableWeight"],
        message: "Enter the chargeable (or actual) weight",
      });
    }
    const total =
      (v.freightAmount || 0) + (v.reimbursementAmount || 0) + (v.hamaliCharges || 0) + (v.otherCharges || 0);
    if ((v.directPaid || 0) > Math.round(total * 100) / 100 + 0.001) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["directPaid"], message: "More than the booking total" });
    }
  });

export type BookingFormValues = z.infer<typeof schema>;

const BLOCK_CODES = ["PLAN_LIMIT_REACHED", "SUBSCRIPTION_EXPIRED"];

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Remove empty strings / undefined so the API only sees what was entered. */
function compact<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "")) as Partial<T>;
}

function fromConsignment(c: Consignment): BookingFormValues {
  return {
    date: String(c.date || "").slice(0, 10),
    party: partyIdOf(c) || "",
    type: c.type,
    destinationStation: c.destinationStation || "",
    originStation: c.originStation || "",
    packages: c.packages,
    actualWeight: c.actualWeight ?? undefined,
    chargeableWeight: c.chargeableWeight ?? undefined,
    contents: c.contents || "",
    agentName: c.agentName || "",
    trainNumber: c.trainNumber || "",
    bogieNumber: c.bogieNumber || "",
    railwayReceiptNumber: c.railwayReceiptNumber || "",
    freightAmount: c.freightAmount ?? 0,
    reimbursementAmount: c.reimbursementAmount || undefined,
    hamaliCharges: c.hamaliCharges || undefined,
    otherCharges: c.otherCharges || undefined,
    paymentMode: c.paymentMode,
    directPaid: c.directPaid || undefined,
    paymentReceiver: c.paymentReceiver || "",
    isLease: !!c.isLease,
    isBooking: !!c.isBooking,
    notes: c.notes || "",
    paymentStatus: c.paymentStatus,
  };
}

export function BookingForm({
  mode,
  initial,
  prefill,
  testID = "booking-form",
}: {
  mode: "create" | "edit";
  initial?: Consignment;
  /** Values to write into the form (route params or quick entry). A new object re-applies. */
  prefill?: BookingPrefill | null;
  testID?: string;
}) {
  const t = useTheme();
  const { isPhone } = useLayout();
  const nav = useAppNav();
  const readOnly = useReadOnly();
  const profile = useBusinessProfile();
  const branches = useBranches();
  const branchId = useBranchStore((s) => s.branchId);
  const receivers = profile.data?.paymentReceivers ?? [];

  const [partyLabel, setPartyLabel] = useState<string | undefined>(initial ? partyNameOf(initial) : undefined);
  const [blocked, setBlocked] = useState<{ code: string; message: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);

  const { control, handleSubmit, setValue, getValues, reset, formState } = useForm<BookingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? fromConsignment(initial)
      : {
          date: isoDay(),
          party: "",
          type: "railway_booking",
          destinationStation: "",
          originStation: "MUM",
          contents: "",
          agentName: "",
          trainNumber: "",
          bogieNumber: "",
          railwayReceiptNumber: "",
          paymentReceiver: "",
          isLease: false,
          isBooking: false,
          notes: "",
        },
  });

  // Edit: when the record arrives / refreshes, load it into the form.
  useEffect(() => {
    if (initial) {
      reset(fromConsignment(initial));
      setPartyLabel(partyNameOf(initial));
    }
  }, [initial, reset]);

  // Create: default origin = the picked branch's station (or head office), else MUM.
  useEffect(() => {
    if (mode !== "create" || !branches.data) return;
    const b =
      branches.data.find((x) => x.id === branchId) ?? branches.data.find((x) => x.isHeadOffice) ?? branches.data[0];
    const code = b?.stationCode?.trim().toUpperCase();
    if (code && !formState.dirtyFields.originStation && !prefill?.originStation) {
      setValue("originStation", code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, branches.data, branchId]);

  const applyPartyDefaults = async (id: string) => {
    try {
      const res = await apiClient.get<Envelope<PartyLite>>(`/parties/${id}`);
      const p = res.data.data;
      if (!p) return;
      if (!partyLabel) setPartyLabel(p.name);
      if (!getValues("destinationStation") && p.defaultStation) {
        setValue("destinationStation", p.defaultStation.toUpperCase(), { shouldDirty: true });
      }
      const pm = p.defaultPaymentMode as BookingFormValues["paymentMode"] | undefined;
      if (!getValues("paymentMode") && pm && (PAYMENT_MODES as readonly string[]).includes(pm)) {
        setValue("paymentMode", pm, { shouldDirty: true });
      }
    } catch {
      /* defaults are a convenience only */
    }
  };

  // Prefill from route params / quick entry.
  useEffect(() => {
    if (!prefill || mode !== "create") return;
    const opts = { shouldDirty: true, shouldValidate: false } as const;
    if (prefill.destinationStation) setValue("destinationStation", prefill.destinationStation.toUpperCase(), opts);
    if (prefill.originStation) setValue("originStation", prefill.originStation.toUpperCase(), opts);
    if (prefill.packages != null && !Number.isNaN(Number(prefill.packages))) setValue("packages", Number(prefill.packages), opts);
    if (prefill.chargeableWeight != null && !Number.isNaN(Number(prefill.chargeableWeight))) {
      setValue("chargeableWeight", Number(prefill.chargeableWeight), opts);
    }
    if (prefill.paymentMode && (PAYMENT_MODES as readonly string[]).includes(prefill.paymentMode)) {
      setValue("paymentMode", prefill.paymentMode, opts);
    }
    if (prefill.freightAmount != null && !Number.isNaN(Number(prefill.freightAmount))) {
      setValue("freightAmount", Number(prefill.freightAmount), opts);
    }
    if (prefill.partyId) {
      setValue("party", prefill.partyId, opts);
      setPartyLabel(prefill.partyName);
      void applyPartyDefaults(prefill.partyId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  const w = useWatch({ control });
  const total = round2(
    (w.freightAmount || 0) + (w.reimbursementAmount || 0) + (w.hamaliCharges || 0) + (w.otherCharges || 0),
  );
  const isAgent = String(w.type || "").startsWith("agent_");

  const invalidate = ["consignments", "parties", "dashboard", "reports", "invoices"];
  const create = useApiMutation<Consignment, Record<string, unknown>>("post", "/consignments", { invalidate });
  const update = useApiMutation<Consignment, Record<string, unknown>>(
    "patch",
    `/consignments/${initial?.id ?? ""}`,
    { invalidate },
  );

  const suggest = async () => {
    const v = getValues();
    const cw = v.chargeableWeight || v.actualWeight;
    if (!v.packages || !cw || !v.destinationStation) {
      toast.error("Enter packages, weight and destination first");
      return;
    }
    setQuoting(true);
    try {
      const res = await apiClient.post<Envelope<Quote>>("/charge-heads/quote", {
        chargeableWeight: cw,
        packages: v.packages,
        destinationStation: v.destinationStation.toUpperCase(),
      });
      const q = res.data.data;
      setQuote(q);
      if (!q.lines.length) {
        toast.info("No rate card heads match — set them up in Settings → Rates");
        return;
      }
      const opts = { shouldDirty: true, shouldValidate: true } as const;
      setValue("freightAmount", q.freightAmount, opts);
      setValue("hamaliCharges", q.hamaliCharges || undefined, opts);
      setValue("otherCharges", q.otherCharges || undefined, opts);
      setValue("reimbursementAmount", q.reimbursementAmount || undefined, opts);
      toast.success(`Charges filled from rate card · ${formatMoney(q.totalAmount)}`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setQuoting(false);
    }
  };

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    setBlocked(null);
    const common = compact({
      type: v.type,
      destinationStation: v.destinationStation.trim().toUpperCase(),
      originStation: v.originStation?.trim().toUpperCase() || undefined,
      packages: v.packages,
      actualWeight: v.actualWeight,
      chargeableWeight: v.chargeableWeight,
      contents: v.contents,
      agentName: String(v.type).startsWith("agent_") ? v.agentName : undefined,
      trainNumber: v.trainNumber,
      bogieNumber: v.bogieNumber,
      railwayReceiptNumber: v.railwayReceiptNumber,
      freightAmount: v.freightAmount,
      reimbursementAmount: v.reimbursementAmount ?? 0,
      hamaliCharges: v.hamaliCharges ?? 0,
      otherCharges: v.otherCharges ?? 0,
      paymentMode: v.paymentMode,
      paymentReceiver: v.paymentReceiver,
      isLease: v.isLease,
      isBooking: v.isBooking,
      notes: v.notes,
    });
    try {
      let saved: Consignment;
      if (mode === "create") {
        saved = await create.mutateAsync({ ...common, date: v.date, party: v.party, directPaid: v.directPaid });
        toast.success("Booking saved");
      } else {
        // Send text fields even when emptied, so a cleared RR no. / note is actually cleared.
        const body: Record<string, unknown> = {
          ...common,
          contents: v.contents ?? "",
          trainNumber: v.trainNumber ?? "",
          bogieNumber: v.bogieNumber ?? "",
          railwayReceiptNumber: v.railwayReceiptNumber ?? "",
          notes: v.notes ?? "",
          paymentReceiver: v.paymentReceiver ?? "",
          ...(String(v.type).startsWith("agent_") ? { agentName: v.agentName ?? "" } : {}),
        };
        const oldDirect = initial?.directPaid || 0;
        const newDirect = v.directPaid || 0;
        if (round2(oldDirect) !== round2(newDirect)) body.directPaid = newDirect;
        else if (v.paymentStatus && v.paymentStatus !== initial?.paymentStatus) body.paymentStatus = v.paymentStatus;
        saved = await update.mutateAsync(body);
        toast.success("Booking updated");
      }
      const id = saved?.id ?? initial?.id;
      if (id) {
        if (nav.replace) nav.replace("BookingDetail", { id });
        else nav.navigate("BookingDetail", { id });
      }
    } catch (err) {
      const code = apiErrorCode(err);
      const message = apiErrorMessage(err);
      if (code && BLOCK_CODES.includes(code)) setBlocked({ code, message });
      else setFormError(message);
      toast.error(message);
    }
  });

  const saving = formState.isSubmitting;

  /* ── field helpers ── */
  const text = (
    name: "contents" | "agentName" | "trainNumber" | "bogieNumber" | "railwayReceiptNumber" | "notes" | "paymentReceiver",
    label: string,
    props: Partial<React.ComponentProps<typeof TextField>> = {},
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field: f, fieldState }) => (
        <TextField
          testID={`booking-${name}`}
          label={label}
          value={(f.value as string) ?? ""}
          onChangeText={f.onChange}
          onBlur={f.onBlur}
          error={fieldState.error?.message}
          {...props}
        />
      )}
    />
  );
  const number = (
    name:
      | "packages"
      | "actualWeight"
      | "chargeableWeight"
      | "freightAmount"
      | "reimbursementAmount"
      | "hamaliCharges"
      | "otherCharges"
      | "directPaid",
    label: string,
    hint?: string,
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field: f, fieldState }) => (
        <NumberField
          testID={`booking-${name}`}
          label={label}
          hint={hint}
          value={f.value as number | undefined}
          onChange={(n) => f.onChange(name === "packages" && n != null ? Math.floor(n) : n)}
          error={fieldState.error?.message}
        />
      )}
    />
  );
  const station = (name: "destinationStation" | "originStation", label: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field: f, fieldState }) => (
        <Combobox<string>
          testID={`booking-${name}`}
          label={label}
          placeholder="Station code"
          valueLabel={f.value ? String(f.value) : undefined}
          selectedValue={f.value || null}
          loadOptions={loadStationOptions}
          onPick={(o) => f.onChange(o ? o.value : "")}
          error={fieldState.error?.message}
          clearable={name === "originStation"}
        />
      )}
    />
  );

  return (
    <Col gap={16} testID={testID}>
      {readOnly ? (
        <Banner
          tone="warning"
          title="Your subscription has expired — the app is read-only"
          message="Renew your plan to add or change bookings."
          action={<Button size="sm" title="Plan" variant="secondary" onPress={() => nav.navigate("Plan")} testID="booking-plan-readonly" />}
          testID="booking-readonly-banner"
        />
      ) : null}
      {blocked ? (
        <Banner
          tone={blocked.code === "PLAN_LIMIT_REACHED" ? "warning" : "danger"}
          title={
            blocked.code === "PLAN_LIMIT_REACHED"
              ? "You have reached this month's booking limit"
              : "Your subscription has expired"
          }
          message={`${blocked.message} Nothing was saved — upgrade or renew, then save again.`}
          action={<Button size="sm" title="Plan" onPress={() => nav.navigate("Plan")} testID="booking-plan-button" />}
          testID="booking-blocked-banner"
        />
      ) : null}
      {formError ? <Banner tone="danger" title="Could not save" message={formError} testID="booking-error" /> : null}

      {/* ── Party & date ── */}
      <Card>
        <SectionHeader title="Party" />
        {mode === "create" ? (
          <FormGrid columns={2}>
            <Controller
              control={control}
              name="date"
              render={({ field: f, fieldState }) => (
                <DateField testID="booking-date" label="Date" value={f.value} onChange={f.onChange} error={fieldState.error?.message} />
              )}
            />
            <Controller
              control={control}
              name="party"
              render={({ field: f, fieldState }) => (
                <Combobox<string>
                  testID="booking-party"
                  label="Party"
                  placeholder="Search party"
                  valueLabel={f.value ? partyLabel || "Selected party" : undefined}
                  selectedValue={f.value || null}
                  loadOptions={loadPartyOptions}
                  onPick={(o) => {
                    f.onChange(o ? o.value : "");
                    setPartyLabel(o?.label);
                    if (o) void applyPartyDefaults(o.value);
                  }}
                  error={fieldState.error?.message}
                />
              )}
            />
          </FormGrid>
        ) : (
          <Row gap={24} wrap>
            <Col gap={2}>
              <Text variant="caption" tone="faint">
                Date
              </Text>
              <Text testID="booking-date-readonly">{formatDate(initial?.date)}</Text>
            </Col>
            <Col gap={2}>
              <Text variant="caption" tone="faint">
                Party
              </Text>
              <Text testID="booking-party-readonly">{partyLabel || "—"}</Text>
            </Col>
            <Text variant="caption" tone="faint" style={{ alignSelf: "flex-end" }}>
              Date and party cannot be changed after booking.
            </Text>
          </Row>
        )}
      </Card>

      {/* ── Parcel & route ── */}
      <Card>
        <SectionHeader title="Parcel & route" />
        <Col gap={14}>
          <FormGrid columns={3}>
            <Controller
              control={control}
              name="type"
              render={({ field: f, fieldState }) => (
                <Select
                  testID="booking-type"
                  label="Type"
                  value={f.value}
                  options={typeOptions}
                  onChange={(v) => v && f.onChange(v)}
                  error={fieldState.error?.message}
                />
              )}
            />
            {station("originStation", "From (origin)")}
            {station("destinationStation", "To (destination)")}
          </FormGrid>
          <FormGrid columns={3}>
            {number("packages", "Packages")}
            {number("actualWeight", "Actual weight (kg)")}
            {number("chargeableWeight", "Chargeable weight (kg)")}
          </FormGrid>
          {text("contents", "Contents", { placeholder: "e.g. Garments, spare parts" })}
          <FormGrid columns={3}>
            {text("trainNumber", "Train no.", { mono: true, autoCapitalize: "characters" })}
            {text("bogieNumber", "Bogie no.", { mono: true, autoCapitalize: "characters" })}
            {text("railwayReceiptNumber", "RR no.", { mono: true, autoCapitalize: "characters" })}
          </FormGrid>
          {isAgent ? text("agentName", "Agent name") : null}
        </Col>
      </Card>

      {/* ── Charges ── */}
      <Card>
        <SectionHeader
          title="Charges"
          action={
            <Button
              size="sm"
              variant="secondary"
              icon={Calculator}
              title="Suggest from rate card"
              onPress={suggest}
              loading={quoting}
              testID="booking-suggest"
            />
          }
        />
        <Col gap={14}>
          <Controller
            control={control}
            name="paymentMode"
            render={({ field: f, fieldState }) => (
              <Col gap={6}>
                <Text variant="label" tone="muted">
                  Payment mode
                </Text>
                <Row gap={6} wrap testID="booking-paymentMode">
                  {paymentModeOptions.map((o) => (
                    <Chip
                      key={o.value}
                      testID={`booking-paymentMode-${o.value}`}
                      label={o.label}
                      selected={f.value === o.value}
                      onPress={() => f.onChange(o.value)}
                    />
                  ))}
                </Row>
                {fieldState.error ? (
                  <Text variant="caption" tone="danger">
                    {fieldState.error.message}
                  </Text>
                ) : null}
              </Col>
            )}
          />
          <FormGrid columns={4}>
            {number("freightAmount", "Freight")}
            {number("reimbursementAmount", "Reimbursement", "Railway freight paid on behalf")}
            {number("hamaliCharges", "Hamali")}
            {number("otherCharges", "Other")}
          </FormGrid>

          {quote && quote.lines.length ? (
            <View
              testID="booking-quote-lines"
              style={{ backgroundColor: t.c.surfaceAlt, borderRadius: t.radius.md, padding: 12, gap: 6 }}
            >
              <Row justify="space-between">
                <Text variant="overline" tone="muted">
                  Rate card
                </Text>
                <Text variant="caption" tone="faint">
                  applied to the fields above
                </Text>
              </Row>
              {quote.lines.map((l, i) => (
                <Row key={`${l.name}-${i}`} justify="space-between" gap={8}>
                  <Text variant="caption" style={{ flex: 1 }}>
                    {l.name} <Text variant="caption" tone="faint">({l.appliesTo})</Text>
                  </Text>
                  <Text variant="caption" tone="muted" style={{ fontFamily: t.fonts.mono }}>
                    {l.basis === "flat" ? "flat" : `${l.qty} × ${formatMoney(l.rate)}${l.basis === "per_kg" ? "/kg" : "/pkg"}`}
                  </Text>
                  <Money value={l.amount} variant="caption" style={{ minWidth: 90, textAlign: "right" }} />
                </Row>
              ))}
            </View>
          ) : null}

          <Divider />
          <Row justify="space-between" testID="booking-total">
            <Text variant="h3">Total</Text>
            <Money value={total} variant="h2" />
          </Row>

          <FormGrid columns={2}>
            <Controller
              control={control}
              name="directPaid"
              render={({ field: f, fieldState }) => (
                <Col gap={6}>
                  <NumberField
                    testID="booking-directPaid"
                    label="Paid now"
                    hint={mode === "edit" ? "Cash taken on this booking (payments are added separately)" : "Cash taken at the counter"}
                    value={f.value}
                    onChange={f.onChange}
                    error={fieldState.error?.message}
                  />
                  <Row gap={6}>
                    <Chip label="Nothing" selected={!f.value} onPress={() => f.onChange(undefined)} testID="booking-paid-none" />
                    <Chip
                      label={`Full ${formatMoney(total)}`}
                      selected={!!f.value && round2(f.value) === total && total > 0}
                      onPress={() => f.onChange(total || undefined)}
                      testID="booking-paid-full"
                    />
                  </Row>
                </Col>
              )}
            />
            {receivers.length ? (
              <Controller
                control={control}
                name="paymentReceiver"
                render={({ field: f, fieldState }) => (
                  <Select
                    testID="booking-paymentReceiver"
                    label="Payment received by"
                    value={f.value || null}
                    options={receivers.map((r) => ({ value: r, label: r }))}
                    onChange={(v) => f.onChange(v ?? "")}
                    clearable
                    error={fieldState.error?.message}
                  />
                )}
              />
            ) : (
              text("paymentReceiver", "Payment received by", { placeholder: "Name (optional)" })
            )}
          </FormGrid>

          {mode === "edit" ? (
            <Controller
              control={control}
              name="paymentStatus"
              render={({ field: f }) => (
                <Select
                  testID="booking-paymentStatus"
                  label="Payment status (manual override)"
                  value={f.value ?? null}
                  options={paymentStatusOptions}
                  onChange={(v) => f.onChange(v ?? undefined)}
                />
              )}
            />
          ) : null}
        </Col>
      </Card>

      {/* ── Classification & notes ── */}
      <Card>
        <SectionHeader title="More" />
        <Col gap={14}>
          <Controller
            control={control}
            name="isLease"
            render={({ field: f }) => (
              <Toggle testID="booking-isLease" label="Lease" hint="Party books on a leased bogie" value={!!f.value} onChange={f.onChange} />
            )}
          />
          <Controller
            control={control}
            name="isBooking"
            render={({ field: f }) => (
              <Toggle testID="booking-isBooking" label="Booking" hint="Regular booking party" value={!!f.value} onChange={f.onChange} />
            )}
          />
          {text("notes", "Notes", { multiline: true })}
        </Col>
      </Card>

      <Row justify="flex-end" gap={8} style={isPhone ? { flexDirection: "column-reverse", alignItems: "stretch" } : undefined}>
        <Button
          title="Cancel"
          variant="secondary"
          onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate("Bookings"))}
          testID="booking-cancel"
          fullWidth={isPhone}
        />
        <Button
          title={mode === "create" ? `Save booking · ${formatMoney(total)}` : "Save changes"}
          icon={Save}
          size="lg"
          onPress={onSubmit}
          loading={saving}
          disabled={readOnly}
          testID="booking-save"
          fullWidth={isPhone}
        />
      </Row>
    </Col>
  );
}
