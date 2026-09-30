/** New / edit bilti. Mirrors bharatrailgo-back/src/modules/pod/pod.validation.js */
import React, { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save } from "lucide-react-native";
import {
  Banner,
  Button,
  Card,
  Col,
  Combobox,
  DateField,
  ErrorState,
  LoadingBlock,
  Money,
  NumberField,
  Row,
  Screen,
  SectionHeader,
  Text,
  TextField,
  toast,
} from "@shared/ui";
import { useLayout, useTheme } from "@shared/useTheme";
import { useApiGet, useApiMutation } from "@shared/api/query";
import {
  apiClient,
  apiErrorCode,
  apiErrorMessage,
  type Envelope,
} from "@shared/api/apiClient";
import {
  loadPartyOptions,
  loadStationOptions,
  useBranches,
  useBusinessProfile,
} from "@shared/api/lookups";
import { useReadOnly } from "@shared/lib/permissions";
import { isoDay } from "@shared/lib/format";
import { useBranchStore } from "@shared/store/useBranchStore";
import { useAppNav, useParams } from "@navigation/useAppNav";
import { FormError, type FormErrorState } from "../components/FormError";
import { biltiNo, partyIdOf, type Pod, type PodInput } from "../types";

const optionalAmount = z
  .number({ invalid_type_error: "Enter a number" })
  .min(0, "Cannot be negative")
  .optional();

const schema = z.object({
  date: z
    .string()
    .trim()
    .min(1, "Date is required")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  party: z.string(),
  consignorName: z.string().trim().min(1, "Consignor name is required"),
  consignorMobile: z.string().trim(),
  consignorAddress: z.string().trim(),
  consigneeName: z.string().trim().min(1, "Consignee name is required"),
  consigneeMobile: z.string().trim(),
  consigneeAddress: z.string().trim(),
  packages: z
    .number({
      required_error: "Enter the number of packages",
      invalid_type_error: "Enter a number",
    })
    .int("Whole packages only")
    .min(1, "At least 1 package"),
  actualWeight: optionalAmount,
  chargeableWeight: z
    .number({
      required_error: "Chargeable weight is required",
      invalid_type_error: "Enter a number",
    })
    .min(0, "Cannot be negative"),
  contents: z.string().trim(),
  givenName: z.string().trim(),
  originStation: z.string().trim(),
  destinationStation: z
    .string()
    .trim()
    .min(1, "Destination station is required"),
  paidAmount: optionalAmount,
  toPayAmount: optionalAmount,
  otherCharges: optionalAmount,
  railwayReceiptNumber: z.string().trim(),
  notes: z.string().trim(),
});
type Form = z.infer<typeof schema>;
type NumKey =
  | "packages"
  | "actualWeight"
  | "chargeableWeight"
  | "paidAmount"
  | "toPayAmount"
  | "otherCharges";
type TextKey = Exclude<
  keyof Form,
  NumKey | "date" | "party" | "originStation" | "destinationStation"
>;

const EMPTY: Partial<Form> = {
  date: isoDay(),
  party: "",
  consignorName: "",
  consignorMobile: "",
  consignorAddress: "",
  consigneeName: "",
  consigneeMobile: "",
  consigneeAddress: "",
  packages: undefined,
  actualWeight: undefined,
  chargeableWeight: undefined,
  contents: "",
  givenName: "",
  originStation: "",
  destinationStation: "",
  paidAmount: undefined,
  toPayAmount: undefined,
  otherCharges: undefined,
  railwayReceiptNumber: "",
  notes: "",
};

function fromPod(p: Pod): Partial<Form> {
  return {
    date: p.date ? isoDay(new Date(p.date)) : isoDay(),
    party: partyIdOf(p.party) || "",
    consignorName: p.consignorName || "",
    consignorMobile: p.consignorMobile || "",
    consignorAddress: p.consignorAddress || "",
    consigneeName: p.consigneeName || "",
    consigneeMobile: p.consigneeMobile || "",
    consigneeAddress: p.consigneeAddress || "",
    packages: p.packages,
    actualWeight: p.actualWeight ?? undefined,
    chargeableWeight: p.chargeableWeight,
    contents: p.contents || "",
    givenName: p.givenName || "",
    originStation: p.originStation || "",
    destinationStation: p.destinationStation || "",
    paidAmount: p.paidAmount || undefined,
    toPayAmount: p.toPayAmount || undefined,
    otherCharges: p.otherCharges || undefined,
    railwayReceiptNumber: p.railwayReceiptNumber || "",
    notes: p.notes || "",
  };
}

interface PartyFull {
  id: string;
  name: string;
  mobile?: string;
  address?: string;
  city?: string;
  state?: string;
}

/** Responsive field grid: one column on phones, `cols` columns otherwise. */
function Grid({
  children,
  cols = 2,
}: {
  children: React.ReactNode;
  cols?: number;
}) {
  const { isPhone } = useLayout();
  return (
    <Row gap={12} wrap align="flex-start">
      {React.Children.toArray(children).map((c, i) => (
        <Col
          key={i}
          style={{
            flexGrow: 1,
            flexBasis: isPhone ? "100%" : `${Math.floor(100 / cols) - 4}%`,
            minWidth: 140,
          }}
        >
          {c}
        </Col>
      ))}
    </Row>
  );
}

/* ───────────── screens ───────────── */

export function BiltiNewScreen() {
  const { partyId } = useParams<{ partyId: string }>();
  return <BiltiForm mode="create" partyId={partyId} />;
}

export function BiltiEditScreen() {
  const { id } = useParams<{ id: string }>();
  const one = useApiGet<Pod>(["pods", id], id ? `/pods/${id}` : null);
  if (one.error) {
    return (
      <Screen title="Edit bilti" back backTo="Bilti" testID="bilti-edit-screen">
        <ErrorState
          message={apiErrorMessage(one.error)}
          onRetry={() => one.refetch()}
        />
      </Screen>
    );
  }
  if (!one.data) {
    return (
      <Screen title="Edit bilti" back backTo="Bilti" testID="bilti-edit-screen">
        <LoadingBlock rows={8} />
      </Screen>
    );
  }
  return <BiltiForm mode="edit" pod={one.data} />;
}

/* ───────────── form ───────────── */

function BiltiForm({
  mode,
  pod,
  partyId,
}: {
  mode: "create" | "edit";
  pod?: Pod;
  partyId?: string;
}) {
  const t = useTheme();
  const nav = useAppNav();
  const { isPhone } = useLayout();
  const readOnly = useReadOnly();
  const profile = useBusinessProfile();
  const branches = useBranches();
  const branchId = useBranchStore((s) => s.branchId);
  const [saveError, setSaveError] = useState<FormErrorState | null>(null);
  const [partyLabel, setPartyLabel] = useState<string | undefined>(
    pod && pod.party && typeof pod.party === "object"
      ? pod.party.name
      : undefined,
  );
  const [partyLoading, setPartyLoading] = useState(false);

  const { control, handleSubmit, formState, setValue, getValues } =
    useForm<Form>({
      resolver: zodResolver(schema),
      defaultValues: pod ? fromPod(pod) : EMPTY,
    });

  const create = useApiMutation<Pod, PodInput>("post", "/pods", {
    invalidate: ["pods", "dashboard", "reports"],
  });
  const update = useApiMutation<Pod, Partial<PodInput>>(
    "patch",
    pod ? `/pods/${pod.id}` : "/pods",
    {
      invalidate: ["pods", "dashboard", "reports"],
    },
  );

  // Default origin = the working branch's station (create only).
  useEffect(() => {
    if (mode !== "create" || getValues("originStation")) return;
    const list = branches.data || [];
    const b =
      branchId !== "all"
        ? list.find((x) => x.id === branchId)
        : list.find((x) => x.isHeadOffice);
    if (b?.stationCode) setValue("originStation", b.stationCode.toUpperCase());
  }, [mode, branches.data, branchId, getValues, setValue]);

  /** Pick a party → copy its name / mobile / address into the consignor block. */
  const applyParty = async (id: string) => {
    setPartyLoading(true);
    try {
      const res = await apiClient.get<Envelope<PartyFull>>(`/parties/${id}`);
      const p = res.data.data;
      setPartyLabel(p.name);
      setValue("party", p.id);
      setValue("consignorName", p.name || "", { shouldValidate: true });
      setValue("consignorMobile", p.mobile || "");
      setValue(
        "consignorAddress",
        [p.address, p.city, p.state].filter(Boolean).join(", "),
      );
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load the party"));
    } finally {
      setPartyLoading(false);
    }
  };

  const initialParty = useRef(false);
  useEffect(() => {
    if (mode === "create" && partyId && !initialParty.current) {
      initialParty.current = true;
      applyParty(partyId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, partyId]);

  const [paid, toPay, other] = useWatch({
    control,
    name: ["paidAmount", "toPayAmount", "otherCharges"],
  });
  const total = (paid || 0) + (toPay || 0) + (other || 0);

  const onSubmit = handleSubmit(async (v) => {
    setSaveError(null);
    const s = (x: string) => (x === "" ? undefined : x);
    const body: PodInput = {
      date: v.date,
      consignorName: v.consignorName,
      consignorMobile:
        mode === "edit" ? v.consignorMobile : s(v.consignorMobile),
      consignorAddress:
        mode === "edit" ? v.consignorAddress : s(v.consignorAddress),
      consigneeName: v.consigneeName,
      consigneeMobile:
        mode === "edit" ? v.consigneeMobile : s(v.consigneeMobile),
      consigneeAddress:
        mode === "edit" ? v.consigneeAddress : s(v.consigneeAddress),
      party: s(v.party),
      packages: v.packages,
      actualWeight: v.actualWeight,
      chargeableWeight: v.chargeableWeight,
      contents: mode === "edit" ? v.contents : s(v.contents),
      givenName: mode === "edit" ? v.givenName : s(v.givenName),
      originStation: s(v.originStation.toUpperCase()),
      destinationStation: v.destinationStation.toUpperCase(),
      paidAmount: v.paidAmount ?? 0,
      toPayAmount: v.toPayAmount ?? 0,
      otherCharges: v.otherCharges ?? 0,
      railwayReceiptNumber:
        mode === "edit" ? v.railwayReceiptNumber : s(v.railwayReceiptNumber),
      notes: mode === "edit" ? v.notes : s(v.notes),
    };
    try {
      if (mode === "create") {
        const saved = await create.mutateAsync(body);
        toast.success(
          `Bilti ${biltiNo(profile.data?.podNumberPrefix, saved.podNumber)} saved`,
        );
        if (nav.replace) nav.replace("BiltiDetail", { id: saved.id });
        else nav.navigate("BiltiDetail", { id: saved.id });
      } else if (pod) {
        const { date: _date, ...patch } = body;
        await update.mutateAsync(patch);
        toast.success("Bilti updated");
        if (nav.canGoBack()) nav.goBack();
        else nav.navigate("BiltiDetail", { id: pod.id });
      }
    } catch (err) {
      const code = apiErrorCode(err);
      const message = apiErrorMessage(err);
      setSaveError({ code, message });
      toast.error(message);
    }
  });

  /* field helpers */
  const txt = (
    name: TextKey,
    label: string,
    props: Partial<React.ComponentProps<typeof TextField>> = {},
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field: f, fieldState }) => (
        <TextField
          testID={`bilti-${name}`}
          label={label}
          value={f.value}
          onChangeText={f.onChange}
          onBlur={f.onBlur}
          error={fieldState.error?.message}
          {...props}
        />
      )}
    />
  );
  const num = (
    name: NumKey,
    label: string,
    props: { hint?: string; placeholder?: string } = {},
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field: f, fieldState }) => (
        <NumberField
          testID={`bilti-${name}`}
          label={label}
          value={f.value}
          onChange={f.onChange}
          error={fieldState.error?.message}
          {...props}
        />
      )}
    />
  );
  const station = (
    name: "originStation" | "destinationStation",
    label: string,
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field: f, fieldState }) => (
        <Combobox
          testID={`bilti-${name}`}
          label={label}
          placeholder="Search station code or name"
          valueLabel={f.value || undefined}
          selectedValue={f.value || null}
          loadOptions={loadStationOptions}
          error={fieldState.error?.message}
          onPick={(o) => f.onChange(o ? o.value : "")}
          clearable={name === "originStation"}
        />
      )}
    />
  );

  const title =
    mode === "create"
      ? "New bilti"
      : `Edit bilti ${biltiNo(profile.data?.podNumberPrefix, pod?.podNumber)}`;
  const busy = formState.isSubmitting;

  return (
    <Screen
      title={title}
      subtitle={
        mode === "create"
          ? "Receipt for goods received at the godown"
          : undefined
      }
      back
      backTo="Bilti"
      maxWidth={960}
      testID={mode === "create" ? "bilti-new-screen" : "bilti-edit-screen"}
    >
      <Col gap={16}>
        {readOnly ? (
          <Banner
            tone="warning"
            title="Read-only mode"
            message="Your subscription has expired, so bilti cannot be saved."
            testID="bilti-form-readonly"
            action={
              <Button
                title="Plan"
                size="sm"
                variant="secondary"
                testID="bilti-form-plan"
                onPress={() => nav.navigate("Plan")}
              />
            }
          />
        ) : null}
        <FormError error={saveError} testID="bilti-form-error" />

        <Card>
          <SectionHeader title="Bilti" />
          <Grid>
            <Controller
              control={control}
              name="date"
              render={({ field: f, fieldState }) =>
                mode === "edit" ? (
                  <TextField
                    label="Date"
                    value={f.value}
                    editable={false}
                    mono
                    testID="bilti-date"
                    hint="Date cannot be changed after issue"
                  />
                ) : (
                  <DateField
                    testID="bilti-date"
                    label="Date"
                    value={f.value}
                    onChange={f.onChange}
                    error={fieldState.error?.message}
                  />
                )
              }
            />
            <Controller
              control={control}
              name="party"
              render={({ field: f }) => (
                <Combobox
                  testID="bilti-party"
                  label="Linked party (optional)"
                  placeholder={
                    partyLoading ? "Loading party…" : "Pick a saved customer"
                  }
                  valueLabel={
                    f.value ? partyLabel || "Linked party" : undefined
                  }
                  selectedValue={f.value || null}
                  loadOptions={loadPartyOptions}
                  clearable={mode === "create"}
                  onPick={(o) => {
                    if (!o) {
                      f.onChange("");
                      setPartyLabel(undefined);
                      return;
                    }
                    setPartyLabel(o.label);
                    f.onChange(o.value);
                    applyParty(o.value);
                  }}
                />
              )}
            />
          </Grid>
        </Card>

        <Row gap={16} wrap align="flex-start">
          <Card style={{ flexGrow: 1, flexBasis: isPhone ? "100%" : 360 }}>
            <SectionHeader title="Consignor (sender)" />
            <Col gap={12}>
              {txt("consignorName", "Name", {
                placeholder: "Who brought the goods",
              })}
              {txt("consignorMobile", "Mobile", {
                keyboardType: "phone-pad",
                maxLength: 13,
              })}
              {txt("consignorAddress", "Address", { multiline: true })}
            </Col>
          </Card>
          <Card style={{ flexGrow: 1, flexBasis: isPhone ? "100%" : 360 }}>
            <SectionHeader title="Consignee (receiver)" />
            <Col gap={12}>
              {txt("consigneeName", "Name", {
                placeholder: "Who receives at destination",
              })}
              {txt("consigneeMobile", "Mobile", {
                keyboardType: "phone-pad",
                maxLength: 13,
                hint: "Used for SMS and WhatsApp updates",
              })}
              {txt("consigneeAddress", "Address", { multiline: true })}
            </Col>
          </Card>
        </Row>

        <Card>
          <SectionHeader title="Parcel & route" />
          <Col gap={12}>
            <Grid cols={3}>
              {num("packages", "Packages")}
              {num("actualWeight", "Actual weight (kg)")}
              {num("chargeableWeight", "Chargeable weight (kg)")}
            </Grid>
            <Grid>
              {txt("contents", "Contents", {
                placeholder: "e.g. Garments, spare parts",
              })}
              {txt("givenName", "Given name", {
                hint: "Alias printed on the parcel",
              })}
            </Grid>
            <Grid>
              {station("originStation", "Origin station")}
              {station("destinationStation", "Destination station")}
            </Grid>
          </Col>
        </Card>

        <Card>
          <SectionHeader title="Charges" />
          <Col gap={12}>
            <Grid cols={3}>
              {num("paidAmount", "Paid (₹)")}
              {num("toPayAmount", "To pay (₹)")}
              {num("otherCharges", "Other charges (₹)")}
            </Grid>
            <Row
              justify="space-between"
              testID="bilti-total"
              style={{
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: t.c.border,
              }}
            >
              <Text variant="overline" tone="muted">
                Total
              </Text>
              <Money value={total} variant="h2" />
            </Row>
          </Col>
        </Card>

        <Card>
          <SectionHeader title="Other" />
          <Col gap={12}>
            {txt("railwayReceiptNumber", "RR number", {
              mono: true,
              autoCapitalize: "characters",
            })}
            {txt("notes", "Notes", { multiline: true })}
          </Col>
        </Card>

        <Row justify="flex-end" gap={8}>
          <Button
            testID="bilti-cancel"
            title="Cancel"
            variant="secondary"
            onPress={() =>
              nav.canGoBack() ? nav.goBack() : nav.navigate("Bilti")
            }
          />
          <Button
            testID="bilti-save"
            title={mode === "create" ? "Save bilti" : "Save changes"}
            icon={Save}
            loading={busy}
            disabled={readOnly}
            onPress={onSubmit}
          />
        </Row>
      </Col>
    </Screen>
  );
}
