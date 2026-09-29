/**
 * Business profile — the owner edits, managers see it read-only.
 * PATCH /business-profile with only the fields that changed.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save } from "lucide-react-native";
import {
  Banner,
  Button,
  Card,
  Col,
  ErrorState,
  KeyValue,
  LoadingBlock,
  NumberField,
  Row,
  Screen,
  Text,
  TextField,
  Toggle,
  toast,
} from "@shared/ui";
import { useTheme } from "@shared/useTheme";
import { useApiMutation } from "@shared/api/query";
import { apiErrorMessage } from "@shared/api/apiClient";
import { useBusinessProfile, type BusinessProfile } from "@shared/api/lookups";
import { useCan, useReadOnly } from "@shared/lib/permissions";
import { CardTitle, Grid, ReadOnlyBanner, StringListEditor } from "../components/common";

const optText = z.string().trim().optional();
const optNum = z.number().min(0).optional();

const schema = z.object({
  businessName: z.string().trim().min(1, "Business name is required"),
  tagline: optText,
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a valid 15-character GSTIN"),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-Z]{5}\d{4}[A-Z])?$/, "PAN looks like ABCDE1234F")
    .optional(),
  mobileNumbers: z.array(z.string()).max(4, "Up to 4 numbers"),
  officeAddress: z.string().trim().min(1, "Office address is required"),
  godownAddress: optText,
  jurisdiction: optText,
  liabilityLimit: optNum,
  bankName: optText,
  bankAccountNumber: optText,
  bankIFSC: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-Z]{4}0[A-Z0-9]{6})?$/, "IFSC looks like SBIN0001234")
    .optional(),
  bankBranch: optText,
  defaultCgstRate: z.number().min(0).max(100, "0–100").optional(),
  defaultSgstRate: z.number().min(0).max(100, "0–100").optional(),
  billNumberPrefix: optText,
  useFinancialYearPrefix: z.boolean(),
  nextBillNumber: z.number().int("Whole number").min(1, "At least 1").optional(),
  nextPodNumber: z.number().int("Whole number").min(1, "At least 1").optional(),
  podNumberPrefix: z.string().trim().max(10, "Up to 10 characters").optional(),
  paymentReceivers: z.array(z.string()).max(30, "Up to 30 names"),
});
type Form = z.infer<typeof schema>;
type Key = keyof Form;

function toForm(p: BusinessProfile): Form {
  return {
    businessName: p.businessName || "",
    tagline: p.tagline || "",
    gstin: p.gstin || "",
    pan: p.pan || "",
    mobileNumbers: p.mobileNumbers || [],
    officeAddress: p.officeAddress || "",
    godownAddress: p.godownAddress || "",
    jurisdiction: p.jurisdiction || "",
    liabilityLimit: p.liabilityLimit ?? undefined,
    bankName: p.bankName || "",
    bankAccountNumber: p.bankAccountNumber || "",
    bankIFSC: p.bankIFSC || "",
    bankBranch: p.bankBranch || "",
    defaultCgstRate: p.defaultCgstRate ?? undefined,
    defaultSgstRate: p.defaultSgstRate ?? undefined,
    billNumberPrefix: p.billNumberPrefix || "",
    useFinancialYearPrefix: !!p.useFinancialYearPrefix,
    nextBillNumber: p.nextBillNumber ?? undefined,
    nextPodNumber: p.nextPodNumber ?? undefined,
    podNumberPrefix: p.podNumberPrefix || "",
    paymentReceivers: p.paymentReceivers || [],
  };
}

const COUNTERS: Key[] = ["nextBillNumber", "nextPodNumber"];

/** Only the fields that differ from the loaded profile; empty numbers are not sent. */
function diff(initial: Form, next: Form, includeCounters: boolean): Partial<Form> {
  const out: Record<string, unknown> = {};
  (Object.keys(next) as Key[]).forEach((k) => {
    if (!includeCounters && COUNTERS.includes(k)) return;
    const a = initial[k];
    const b = next[k];
    if (JSON.stringify(a ?? null) === JSON.stringify(b ?? null)) return;
    if (b === undefined) return; // cleared number: the API cannot unset it
    out[k] = typeof b === "string" ? b.trim() : b;
  });
  return out as Partial<Form>;
}

function fyLabel(d = new Date()) {
  const y = d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1;
  return `${String(y).slice(-2)}-${String(y + 1).slice(-2)}`;
}

export function sampleBillNumber(prefix: string | undefined, useFy: boolean, next: number | undefined) {
  const n = next ?? 1;
  return useFy ? `${prefix || ""}${fyLabel()}/${String(n).padStart(3, "0")}` : `${prefix || ""}${n}`;
}

export function SettingsBusinessScreen() {
  const canEdit = useCan("settings.manage");
  const profile = useBusinessProfile();

  return (
    <Screen
      title="Business profile"
      subtitle={canEdit ? "Printed on every bilti, invoice and report." : "Only the owner can change these details."}
      back
      backTo="Settings"
      refreshing={profile.isRefetching}
      onRefresh={() => profile.refetch()}
      testID="settings-business-screen"
    >
      {profile.isLoading ? (
        <LoadingBlock rows={8} />
      ) : profile.error || !profile.data ? (
        <ErrorState message={apiErrorMessage(profile.error, "Could not load the profile")} onRetry={() => profile.refetch()} />
      ) : canEdit ? (
        <BusinessForm profile={profile.data} />
      ) : (
        <BusinessReadOnly p={profile.data} />
      )}
    </Screen>
  );
}

function BusinessReadOnly({ p }: { p: BusinessProfile }) {
  const t = useTheme();
  const mono = (v?: string | number | null) =>
    v == null || v === "" ? <Text>—</Text> : <Text style={{ fontFamily: t.fonts.mono }}>{String(v)}</Text>;
  return (
    <Col gap={14} testID="business-readonly">
      <Banner tone="info" title="View only" message="Ask the owner to change the business profile." />
      <Card>
        <CardTitle title="Agency" />
        <KeyValue
          items={[
            ["Business name", p.businessName],
            ["Tagline", p.tagline || "—"],
            ["GSTIN", mono(p.gstin)],
            ["PAN", mono(p.pan)],
            ["Mobiles", (p.mobileNumbers || []).join(", ") || "—"],
            ["Jurisdiction", p.jurisdiction || "—"],
            ["Office address", p.officeAddress || "—"],
            ["Godown address", p.godownAddress || "—"],
            ["Liability limit", p.liabilityLimit != null ? `₹${p.liabilityLimit}` : "—"],
          ]}
        />
      </Card>
      <Card>
        <CardTitle title="Tax & numbering" />
        <KeyValue
          items={[
            ["Default CGST", p.defaultCgstRate != null ? `${p.defaultCgstRate}%` : "—"],
            ["Default SGST", p.defaultSgstRate != null ? `${p.defaultSgstRate}%` : "—"],
            ["Next bill no.", mono(sampleBillNumber(p.billNumberPrefix, !!p.useFinancialYearPrefix, p.nextBillNumber))],
            ["Next bilti no.", mono(`${p.podNumberPrefix || ""}${p.nextPodNumber ?? ""}`)],
            ["Payment receivers", (p.paymentReceivers || []).join(", ") || "Free text"],
          ]}
        />
      </Card>
    </Col>
  );
}

function TF({
  control,
  name,
  label,
  ...props
}: { control: Control<Form>; name: Key; label: string } & Partial<React.ComponentProps<typeof TextField>>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: f, fieldState }) => (
        <TextField
          testID={`business-${name}`}
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
}

function NF({
  control,
  name,
  label,
  hint,
}: {
  control: Control<Form>;
  name: Key;
  label: string;
  hint?: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: f, fieldState }) => (
        <NumberField
          testID={`business-${name}`}
          label={label}
          hint={hint}
          value={f.value as number | undefined}
          onChange={f.onChange}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}

function BusinessForm({ profile }: { profile: BusinessProfile }) {
  const readOnly = useReadOnly();
  const initial = useMemo(() => toForm(profile), [profile]);
  const [advanced, setAdvanced] = useState(false);
  const { control, handleSubmit, reset, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  });

  useEffect(() => {
    reset(initial);
  }, [initial, reset]);

  const save = useApiMutation<BusinessProfile, Partial<Form>>("patch", "/business-profile", {
    invalidate: ["business-profile"],
  });

  const values = useWatch({ control }) as Form;
  const pending = diff(initial, values, advanced);
  const dirtyCount = Object.keys(pending).length;

  const onSubmit = handleSubmit(async (v) => {
    const body = diff(initial, v, advanced);
    if (!Object.keys(body).length) {
      toast.info("Nothing to save");
      return;
    }
    try {
      await save.mutateAsync(body);
      toast.success("Business profile saved");
      setAdvanced(false);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  });

  const saveBar = (
    <Row justify="flex-end" gap={8} wrap>
      {dirtyCount ? (
        <Text variant="caption" tone="muted" testID="business-dirty-count">
          {dirtyCount} unsaved change{dirtyCount === 1 ? "" : "s"}
        </Text>
      ) : null}
      <Button
        testID="business-reset"
        title="Discard"
        variant="secondary"
        disabled={!dirtyCount || save.isPending}
        onPress={() => {
          reset(initial);
          setAdvanced(false);
        }}
      />
      <Button
        testID="business-save"
        title="Save changes"
        icon={Save}
        loading={save.isPending || formState.isSubmitting}
        disabled={readOnly || !dirtyCount}
        onPress={onSubmit}
      />
    </Row>
  );

  return (
    <Col gap={16} testID="business-form">
      <ReadOnlyBanner />

      <Card>
        <CardTitle title="Agency" caption="Shown in the bilti and invoice header." />
        <Grid>
          <TF control={control} name="businessName" label="Business name *" />
          <TF control={control} name="tagline" label="Tagline" placeholder="e.g. Railway parcel booking agent" />
          <TF control={control} name="gstin" label="GSTIN *" autoCapitalize="characters" mono maxLength={15} />
          <TF control={control} name="pan" label="PAN" autoCapitalize="characters" mono maxLength={10} />
          <TF control={control} name="jurisdiction" label="Jurisdiction" placeholder="Subject to Mumbai jurisdiction" />
          <NF control={control} name="liabilityLimit" label="Liability limit (₹)" hint="Printed in the bilti terms" />
        </Grid>
        <Col gap={14} style={{ marginTop: 14 }}>
          <Controller
            control={control}
            name="mobileNumbers"
            render={({ field: f, fieldState }) => (
              <Col gap={4}>
                <StringListEditor
                  testID="business-mobiles"
                  label="Mobile numbers"
                  value={f.value}
                  onChange={f.onChange}
                  max={4}
                  mono
                  keyboardType="phone-pad"
                  placeholder="10-digit mobile"
                  validate={(s) => (/^[+\d][\d\s-]{6,14}$/.test(s) ? null : "Enter a valid phone number")}
                />
                {fieldState.error ? (
                  <Text variant="caption" tone="danger">
                    {fieldState.error.message}
                  </Text>
                ) : null}
              </Col>
            )}
          />
          <Grid basis={320}>
            <TF control={control} name="officeAddress" label="Office address *" multiline />
            <TF control={control} name="godownAddress" label="Godown address" multiline />
          </Grid>
        </Col>
      </Card>

      <Card>
        <CardTitle title="Bank details" caption="Printed on invoices for payment." />
        <Grid>
          <TF control={control} name="bankName" label="Bank name" />
          <TF control={control} name="bankAccountNumber" label="Account number" mono keyboardType="number-pad" />
          <TF control={control} name="bankIFSC" label="IFSC" mono autoCapitalize="characters" maxLength={11} />
          <TF control={control} name="bankBranch" label="Branch" />
        </Grid>
      </Card>

      <Card>
        <CardTitle title="Tax" caption="Default GST rates for new invoices." />
        <Grid>
          <NF control={control} name="defaultCgstRate" label="Default CGST (%)" />
          <NF control={control} name="defaultSgstRate" label="Default SGST (%)" />
        </Grid>
      </Card>

      <NumberingCard control={control} values={values} advanced={advanced} setAdvanced={setAdvanced} />

      <Card>
        <CardTitle
          title="Payment receivers"
          caption="People who collect cash or cheques. Payments must name one of them."
        />
        <Controller
          control={control}
          name="paymentReceivers"
          render={({ field: f }) => (
            <StringListEditor
              testID="business-receivers"
              label="Receivers"
              value={f.value}
              onChange={f.onChange}
              max={30}
              placeholder="e.g. Ramesh, Office cash"
              hint={
                f.value.length
                  ? "Only these names are accepted as “received by” on payments."
                  : "The list is empty, so “received by” is free text on payments. Add names to restrict it."
              }
              validate={(s) => (s.length > 40 ? "Up to 40 characters" : null)}
            />
          )}
        />
      </Card>

      {saveBar}
    </Col>
  );
}

function NumberingCard({
  control,
  values,
  advanced,
  setAdvanced,
}: {
  control: Control<Form>;
  values: Form;
  advanced: boolean;
  setAdvanced: (v: boolean) => void;
}) {
  const t = useTheme();
  return (
    <Card testID="business-numbering">
      <CardTitle title="Numbering" caption="How bill (invoice) and bilti numbers are generated." />
      <Grid>
        <TF control={control} name="billNumberPrefix" label="Bill number prefix" mono autoCapitalize="characters" placeholder="e.g. SG/" />
        <TF control={control} name="podNumberPrefix" label="Bilti number prefix" mono autoCapitalize="characters" maxLength={10} placeholder="e.g. B-" />
      </Grid>
      <Col gap={14} style={{ marginTop: 14 }}>
        <Controller
          control={control}
          name="useFinancialYearPrefix"
          render={({ field: f }) => (
            <Toggle
              testID="business-useFinancialYearPrefix"
              label="Financial-year prefix on bill numbers"
              hint="e.g. 25-26/001 — numbering restarts visibly each April."
              value={f.value}
              onChange={f.onChange}
            />
          )}
        />
        <Row wrap gap={16}>
          <Col gap={2}>
            <Text variant="caption" tone="faint">
              Next bill number
            </Text>
            <Text testID="business-bill-sample" style={{ fontFamily: t.fonts.mono }}>
              {sampleBillNumber(values.billNumberPrefix, values.useFinancialYearPrefix, values.nextBillNumber)}
            </Text>
          </Col>
          <Col gap={2}>
            <Text variant="caption" tone="faint">
              Next bilti number
            </Text>
            <Text testID="business-bilti-sample" style={{ fontFamily: t.fonts.mono }}>
              {`${values.podNumberPrefix || ""}${values.nextPodNumber ?? ""}`}
            </Text>
          </Col>
        </Row>
        <Toggle
          testID="business-advanced-numbering"
          label="Advanced — change numbering"
          hint="Only to continue from an old register or fix a mistake."
          value={advanced}
          onChange={setAdvanced}
        />
        {advanced ? (
          <Col gap={12}>
            <Banner
              testID="business-numbering-warning"
              tone="warning"
              title="Changing counters can create duplicate numbers"
              message="If you set a number that was already used, two bills or biltis will share it. Only move counters forward past the last number you issued."
            />
            <Grid>
              <NF control={control} name="nextBillNumber" label="Next bill number" />
              <NF control={control} name="nextPodNumber" label="Next bilti number" />
            </Grid>
          </Col>
        ) : null}
      </Col>
    </Card>
  );
}
