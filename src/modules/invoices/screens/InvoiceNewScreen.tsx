/**
 * New GST invoice, in two steps:
 *   1. party + bill date + GST mode (rates default from the business profile)
 *   2. pick the party's un-invoiced on-bill bookings, with a live tax preview
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { ArrowLeft, ArrowRight, Check } from "lucide-react-native";
import {
  Banner,
  Button,
  Card,
  Col,
  Combobox,
  DateField,
  Row,
  Screen,
  SectionHeader,
  Text,
  TextField,
  toast,
} from "@shared/ui";
import { useLayout, useTheme } from "@shared/useTheme";
import { useApiGet, useApiMutation } from "@shared/api/query";
import { apiErrorCode, apiErrorMessage } from "@shared/api/apiClient";
import {
  loadPartyOptions,
  useBusinessProfile,
  type PartyLite,
} from "@shared/api/lookups";
import { formatDate, isoDay } from "@shared/lib/format";
import { useReadOnly } from "@shared/lib/permissions";
import { useAppNav, useParams } from "@navigation/useAppNav";
import { ConsignmentPicker } from "../components/ConsignmentPicker";
import { GstFields } from "../components/GstFields";
import { TotalsBlock } from "../components/TotalsBlock";
import {
  computeSubtotals,
  computeTotals,
  ratesFor,
  useUninvoicedConsignments,
  type GstMode,
  type Rates,
} from "../lib";
import {
  INVOICE_INVALIDATE,
  type Invoice,
  type InvoiceCreateInput,
} from "../types";

function StepDot({
  n,
  label,
  active,
  done,
}: {
  n: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  const t = useTheme();
  const on = active || done;
  return (
    <Row gap={8} testID={`invoice-step-${n}${active ? "-active" : ""}`}>
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: on ? t.c.accent : t.c.surfaceAlt,
        }}
      >
        {done ? (
          <Check size={14} color={t.c.accentText} />
        ) : (
          <Text
            variant="label"
            style={{ color: on ? t.c.accentText : t.c.textMuted }}
          >
            {n}
          </Text>
        )}
      </View>
      <Text variant="label" tone={active ? "default" : "muted"}>
        {label}
      </Text>
    </Row>
  );
}

export function InvoiceNewScreen() {
  const { isDesktop } = useLayout();
  const nav = useAppNav();
  const readOnly = useReadOnly();
  const { partyId: paramPartyId } = useParams<{ partyId: string }>();
  const profile = useBusinessProfile();

  const [step, setStep] = useState<1 | 2>(1);
  const [party, setParty] = useState<{ id: string; name: string } | null>(null);
  const [date, setDate] = useState(isoDay());
  const [gstMode, setGstMode] = useState<GstMode>("intra");
  const [rates, setRates] = useState<Rates>(ratesFor("intra", {}));
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expired, setExpired] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const defaults = useMemo(
    () => ({
      cgst: profile.data?.defaultCgstRate,
      sgst: profile.data?.defaultSgstRate,
    }),
    [profile.data],
  );

  // Apply the business profile's default rates once it loads (unless the user already edited them).
  const ratesTouched = useRef(false);
  useEffect(() => {
    if (profile.data && !ratesTouched.current)
      setRates(ratesFor(gstMode, defaults));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.data]);

  const preParty = useApiGet<PartyLite>(
    ["parties", paramPartyId],
    paramPartyId ? `/parties/${paramPartyId}` : null,
  );
  useEffect(() => {
    if (preParty.data && !party)
      setParty({ id: preParty.data.id, name: preParty.data.name });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preParty.data]);

  const open = useUninvoicedConsignments(party?.id);

  // Drop selections that are no longer available (party changed, list refreshed).
  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(open.items.map((c) => c.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [open.items]);

  const chosen = useMemo(
    () => open.items.filter((c) => selected.has(c.id)),
    [open.items, selected],
  );
  const totals = useMemo(
    () => computeTotals(computeSubtotals(chosen), rates),
    [chosen, rates],
  );

  const create = useApiMutation<Invoice, InvoiceCreateInput>(
    "post",
    "/invoices",
    { invalidate: INVOICE_INVALIDATE },
  );

  const goStep2 = () => {
    if (!party) return setErr("Pick the party to bill.");
    if (!date) return setErr("Pick the bill date.");
    setErr(null);
    setStep(2);
  };

  const submit = async () => {
    if (!party || selected.size === 0) return;
    setErr(null);
    setExpired(false);
    try {
      const inv = await create.mutateAsync({
        party: party.id,
        date,
        consignmentIds: [...selected],
        cgstRate: rates.cgstRate,
        sgstRate: rates.sgstRate,
        igstRate: rates.igstRate,
        notes: notes.trim() || undefined,
      });
      toast.success(`Invoice ${inv.billNumber} created as draft`);
      if (nav.replace) nav.replace("InvoiceDetail", { id: inv.id });
      else nav.navigate("InvoiceDetail", { id: inv.id });
    } catch (e) {
      if (apiErrorCode(e) === "SUBSCRIPTION_EXPIRED") setExpired(true);
      setErr(apiErrorMessage(e));
      toast.error(apiErrorMessage(e));
    }
  };

  const expiredBanner =
    expired || readOnly ? (
      <Banner
        tone="danger"
        title="Subscription expired"
        message="Your account is read-only, so invoices cannot be created. Renew your plan in Settings → Plan."
        action={
          <Button
            title="View plan"
            size="sm"
            variant="secondary"
            onPress={() => nav.navigate("Plan")}
            testID="invoice-view-plan"
          />
        }
        testID="invoice-subscription-expired"
      />
    ) : null;

  const errText = err ? (
    <Text tone="danger" testID="invoice-new-error">
      {err}
    </Text>
  ) : null;

  return (
    <Screen
      title="New invoice"
      back
      backTo="Invoices"
      testID="invoice-new-screen"
      maxWidth={1100}
    >
      <Col gap={16}>
        {expiredBanner}
        <Row gap={16} wrap>
          <StepDot
            n={1}
            label="Party & GST"
            active={step === 1}
            done={step === 2}
          />
          <View
            style={{ width: 24, height: 1, backgroundColor: "transparent" }}
          />
          <StepDot
            n={2}
            label="Pick bookings"
            active={step === 2}
            done={false}
          />
        </Row>

        {step === 1 ? (
          <Card style={{ maxWidth: 620 }}>
            <Col gap={16}>
              <Combobox<string>
                label="Party"
                placeholder="Which on-bill party?"
                valueLabel={party?.name}
                selectedValue={party?.id ?? null}
                loadOptions={loadPartyOptions}
                onPick={(o) => {
                  setParty(o ? { id: o.value, name: o.label } : null);
                  setSelected(new Set());
                }}
                testID="invoice-party"
              />
              <DateField
                label="Bill date"
                value={date}
                onChange={setDate}
                testID="invoice-date"
              />
              <GstFields
                mode={gstMode}
                rates={rates}
                onMode={(m) => {
                  setGstMode(m);
                  setRates(ratesFor(m, defaults));
                }}
                onRates={(r) => {
                  ratesTouched.current = true;
                  setRates(r);
                }}
                testID="invoice-gst"
              />
              <Text variant="caption" tone="faint">
                The bill number is assigned automatically when the invoice is
                created.
              </Text>
              {errText}
              <Row justify="flex-end">
                <Button
                  title="Next: pick bookings"
                  icon={ArrowRight}
                  onPress={goStep2}
                  testID="invoice-next"
                />
              </Row>
            </Col>
          </Card>
        ) : (
          <Col gap={16}>
            <Card tone="sunken" padding={12}>
              <Row justify="space-between" wrap gap={8}>
                <Text>
                  <Text variant="bodyStrong">{party?.name}</Text>
                  <Text tone="muted">
                    {" "}
                    · {formatDate(date)} ·{" "}
                    {gstMode === "intra"
                      ? `CGST ${rates.cgstRate}% + SGST ${rates.sgstRate}%`
                      : `IGST ${rates.igstRate}%`}
                  </Text>
                </Text>
                <Button
                  title="Change"
                  variant="ghost"
                  size="sm"
                  icon={ArrowLeft}
                  onPress={() => setStep(1)}
                  testID="invoice-back"
                />
              </Row>
            </Card>

            <Row
              gap={20}
              align="flex-start"
              style={{ flexDirection: isDesktop ? "row" : "column" }}
            >
              <View
                style={{
                  flex: isDesktop ? 1.4 : undefined,
                  width: isDesktop ? undefined : "100%",
                }}
              >
                <SectionHeader title="Un-invoiced on-bill bookings" />
                <ConsignmentPicker
                  items={open.items}
                  selected={selected}
                  onChange={setSelected}
                  loading={open.isLoading}
                  error={open.error}
                  onRetry={open.refetch}
                  testID="invoice-picker"
                  emptyAction={
                    <Button
                      title="Choose another party"
                      variant="secondary"
                      onPress={() => setStep(1)}
                      testID="invoice-picker-empty-back"
                    />
                  }
                />
              </View>
              <View
                style={{
                  flex: isDesktop ? 1 : undefined,
                  width: isDesktop ? undefined : "100%",
                  gap: 12,
                }}
              >
                <SectionHeader title={`${selected.size} selected`} />
                <TotalsBlock totals={totals} preview testID="invoice-preview" />
                <TextField
                  label="Notes (optional)"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  testID="invoice-notes"
                />
                {errText}
                <Button
                  title={
                    selected.size
                      ? `Create draft invoice (${selected.size})`
                      : "Select bookings to bill"
                  }
                  size="lg"
                  fullWidth
                  onPress={submit}
                  disabled={selected.size === 0 || readOnly}
                  loading={create.isPending}
                  testID="invoice-create"
                />
              </View>
            </Row>
          </Col>
        )}
      </Col>
    </Screen>
  );
}
