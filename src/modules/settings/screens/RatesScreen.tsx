/**
 * Rate card (charge heads) grouped by what they add to — freight, hamali,
 * other, reimbursement — plus a "Try the rate card" quote tester.
 */
import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { Calculator, Pencil, Plus, Receipt } from "lucide-react-native";
import { useTheme } from "@shared/useTheme";
import {
  Button,
  Card,
  Col,
  Combobox,
  DataList,
  Dialog,
  Divider,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingBlock,
  Money,
  NumberField,
  Row,
  Screen,
  SectionHeader,
  SegmentedControl,
  Select,
  StatusPill,
  Text,
  TextField,
  Toggle,
  toast,
  type Column,
} from "@shared/ui";
import { useApiGet, useApiMutation } from "@shared/api/query";
import { apiClient, apiErrorMessage, type Envelope } from "@shared/api/apiClient";
import { loadStationOptions } from "@shared/api/lookups";
import { useCan, useReadOnly } from "@shared/lib/permissions";
import { formatNumber } from "@shared/lib/format";
import { APPLIES_TO_LABEL, BASIS_LABEL, type AppliesTo, type Basis, type ChargeHead, type Quote } from "../types";
import { CardTitle, Grid, ReadOnlyBanner } from "../components/common";

const GROUPS: AppliesTo[] = ["freight", "hamali", "other", "reimbursement"];
const BASIS_UNIT: Record<Basis, string> = { per_kg: "/kg", per_package: "/pkg", flat: "flat" };

interface HeadInput {
  name: string;
  appliesTo: AppliesTo;
  basis: Basis;
  rate: number;
  minAmount?: number;
  stationCode?: string | null;
  isActive?: boolean;
}

function StationTag({ code }: { code: string }) {
  const t = useTheme();
  return (
    <View style={{ alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: t.radius.pill, backgroundColor: t.c.accentSoft }}>
      <Text variant="caption" tone="accent" style={{ fontFamily: t.fonts.mono }}>
        Only to {code}
      </Text>
    </View>
  );
}

/* ─────────────── Add / edit dialog ─────────────── */

function HeadDialog({
  head,
  visible,
  defaultGroup,
  onClose,
}: {
  head: ChargeHead | null;
  visible: boolean;
  defaultGroup: AppliesTo;
  onClose: () => void;
}) {
  const isEdit = !!head;
  const [form, setForm] = useState<HeadInput>({ name: "", appliesTo: "freight", basis: "per_kg", rate: 0 });
  const [rate, setRate] = useState<number | undefined>(undefined);
  const [touched, setTouched] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const key = visible ? head?.id ?? `new-${defaultGroup}` : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    setTouched(false);
    setForm({
      name: head?.name || "",
      appliesTo: head?.appliesTo || defaultGroup,
      basis: head?.basis || "per_kg",
      rate: head?.rate ?? 0,
      minAmount: head?.minAmount || undefined,
      stationCode: head?.stationCode ?? null,
      isActive: head?.isActive ?? true,
    });
    setRate(head?.rate);
  }
  const set = <K extends keyof HeadInput>(k: K, v: HeadInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const create = useApiMutation<ChargeHead, HeadInput>("post", "/charge-heads", { invalidate: ["charge-heads"] });
  const update = useApiMutation<ChargeHead, { id: string; body: Partial<HeadInput> }>("patch", (v) => `/charge-heads/${v.id}`, {
    invalidate: ["charge-heads"],
    body: (v) => v.body,
  });

  const nameErr = touched && !form.name.trim() ? "Enter a name, e.g. Freight or Hamali" : undefined;
  const rateErr = touched && rate == null ? "Enter a rate (0 is allowed)" : undefined;

  const save = async () => {
    setTouched(true);
    if (!form.name.trim() || rate == null) return;
    const body: HeadInput = {
      name: form.name.trim(),
      appliesTo: form.appliesTo,
      basis: form.basis,
      rate,
      minAmount: form.minAmount ?? 0,
      stationCode: form.stationCode || null,
    };
    try {
      if (head) {
        await update.mutateAsync({ id: head.id, body: { ...body, isActive: form.isActive } });
        toast.success("Charge head updated");
      } else {
        await create.mutateAsync(body);
        toast.success(`${body.name} added to the rate card`);
      }
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title={isEdit ? `Edit ${head?.name}` : "Add charge head"}
      testID="rate-dialog"
      footer={
        <>
          <Button testID="rate-cancel" title="Cancel" variant="secondary" onPress={onClose} />
          <Button testID="rate-save" title={isEdit ? "Save" : "Add"} loading={create.isPending || update.isPending} onPress={save} />
        </>
      }
    >
      <TextField testID="rate-name" label="Name" value={form.name} onChangeText={(s) => set("name", s)} maxLength={60} error={nameErr} placeholder="e.g. Freight, Hamali, Packing" />
      <Select<AppliesTo>
        testID="rate-appliesTo"
        label="Adds to"
        value={form.appliesTo}
        onChange={(v) => v && set("appliesTo", v)}
        options={GROUPS.map((g) => ({ value: g, label: APPLIES_TO_LABEL[g] }))}
      />
      <Col gap={6}>
        <Text variant="label" tone="muted">
          Basis
        </Text>
        <SegmentedControl<Basis>
          testID="rate-basis"
          value={form.basis}
          onChange={(v) => set("basis", v)}
          options={(Object.keys(BASIS_LABEL) as Basis[]).map((b) => ({ value: b, label: BASIS_LABEL[b] }))}
        />
      </Col>
      <Grid basis={180}>
        <NumberField
          testID="rate-rate"
          label={form.basis === "flat" ? "Amount (₹)" : `Rate (₹ ${BASIS_UNIT[form.basis]})`}
          value={rate}
          onChange={setRate}
          error={rateErr}
        />
        <NumberField
          testID="rate-minAmount"
          label="Minimum (₹)"
          value={form.minAmount}
          onChange={(v) => set("minAmount", v)}
          hint="Charged when the rate works out lower"
        />
      </Grid>
      <Combobox<string>
        testID="rate-station"
        label="Only for destination (optional)"
        placeholder="All destinations"
        valueLabel={form.stationCode || undefined}
        selectedValue={form.stationCode || null}
        loadOptions={loadStationOptions}
        onPick={(o) => set("stationCode", o ? o.value : null)}
        clearable
      />
      <Text variant="caption" tone="faint">
        A station-specific head replaces the general head with the same name for that destination.
      </Text>
      {isEdit ? (
        <Toggle testID="rate-active" label="Active" hint="Inactive heads are not used in quotes." value={!!form.isActive} onChange={(v) => set("isActive", v)} />
      ) : null}
    </Dialog>
  );
}

/* ─────────────── Quote tester ─────────────── */

function QuoteTester() {
  const t = useTheme();
  const [weight, setWeight] = useState<number | undefined>(50);
  const [packages, setPackages] = useState<number | undefined>(1);
  const [dest, setDest] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = weight != null && packages != null && packages >= 1 && Number.isInteger(packages) && !!dest;

  const run = async () => {
    if (!valid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post<Envelope<Quote>>("/charge-heads/quote", {
        chargeableWeight: weight,
        packages,
        destinationStation: dest,
      });
      setQuote(res.data.data);
    } catch (err) {
      setError(apiErrorMessage(err));
      setQuote(null);
    } finally {
      setLoading(false);
    }
  };

  const totals: [string, number][] = quote
    ? [
        ["Freight", quote.freightAmount],
        ["Hamali", quote.hamaliCharges],
        ["Other", quote.otherCharges],
        ["Reimbursement", quote.reimbursementAmount],
      ]
    : [];

  return (
    <Card testID="rate-tester">
      <CardTitle title="Try the rate card" caption="Check what a booking would cost with the active charge heads." />
      <Grid basis={180}>
        <NumberField testID="rate-tester-weight" label="Chargeable weight (kg)" value={weight} onChange={setWeight} />
        <NumberField testID="rate-tester-packages" label="Packages" value={packages} onChange={(v) => setPackages(v == null ? undefined : Math.floor(v))} />
        <Combobox<string>
          testID="rate-tester-destination"
          label="Destination"
          placeholder="Pick a station"
          valueLabel={dest || undefined}
          selectedValue={dest}
          loadOptions={loadStationOptions}
          onPick={(o) => setDest(o ? o.value : null)}
        />
      </Grid>
      <Row justify="flex-end" style={{ marginTop: 14 }}>
        <Button testID="rate-tester-run" title="Get quote" icon={Calculator} loading={loading} disabled={!valid} onPress={run} />
      </Row>
      {error ? (
        <Text tone="danger" style={{ marginTop: 10 }}>
          {error}
        </Text>
      ) : null}
      {quote ? (
        <Col gap={10} style={{ marginTop: 14 }} testID="rate-tester-result">
          <Divider />
          {quote.lines.length === 0 ? (
            <Text tone="muted">No active charge heads apply to this destination.</Text>
          ) : (
            quote.lines.map((l, i) => (
              <Row key={`${l.name}-${i}`} justify="space-between" gap={12} testID={`rate-tester-line-${i}`}>
                <Col gap={1} flex={1}>
                  <Text>{l.name}</Text>
                  <Text variant="caption" tone="faint" style={{ fontFamily: t.fonts.mono }}>
                    {l.basis === "flat" ? "flat" : `${formatNumber(l.qty)} × ₹${formatNumber(l.rate)}${BASIS_UNIT[l.basis]}`} · {APPLIES_TO_LABEL[l.appliesTo]}
                  </Text>
                </Col>
                <Money value={l.amount} />
              </Row>
            ))
          )}
          <Divider />
          <Row wrap gap={16}>
            {totals.map(([k, v]) => (
              <Col key={k} gap={1}>
                <Text variant="caption" tone="faint">
                  {k}
                </Text>
                <Money value={v} variant="mono" tone="muted" />
              </Col>
            ))}
          </Row>
          <Row justify="space-between">
            <Text variant="h3">Total</Text>
            <View testID="rate-tester-total">
              <Money value={quote.totalAmount} variant="h2" />
            </View>
          </Row>
        </Col>
      ) : null}
    </Card>
  );
}

/* ─────────────── Screen ─────────────── */

export function RatesScreen() {
  const canEdit = useCan("masters.manage");
  const readOnly = useReadOnly();
  const editable = canEdit && !readOnly;
  const list = useApiGet<ChargeHead[]>(["charge-heads"], "/charge-heads", { includeInactive: canEdit ? true : undefined });
  const [dialog, setDialog] = useState<{ head: ChargeHead | null; group: AppliesTo } | null>(null);

  const grouped = useMemo(() => {
    const m: Record<AppliesTo, ChargeHead[]> = { freight: [], hamali: [], other: [], reimbursement: [] };
    (list.data || []).forEach((h) => m[h.appliesTo]?.push(h));
    return m;
  }, [list.data]);

  const columns: Column<ChargeHead>[] = [
    {
      key: "name",
      title: "Name",
      flex: 2,
      render: (h) => (
        <Col gap={4}>
          <Text variant="bodyStrong">{h.name}</Text>
          {h.stationCode ? <StationTag code={h.stationCode} /> : null}
        </Col>
      ),
    },
    { key: "basis", title: "Basis", render: (h) => <Text tone="muted">{BASIS_LABEL[h.basis]}</Text> },
    {
      key: "rate",
      title: "Rate",
      align: "right",
      render: (h) => (
        <Row gap={2}>
          <Money value={h.rate} />
          {h.basis !== "flat" ? (
            <Text variant="caption" tone="faint">
              {BASIS_UNIT[h.basis]}
            </Text>
          ) : null}
        </Row>
      ),
    },
    {
      key: "min",
      title: "Minimum",
      align: "right",
      render: (h) => (h.minAmount ? <Money value={h.minAmount} tone="muted" /> : <Text tone="faint">—</Text>),
    },
    {
      key: "status",
      title: "Status",
      render: (h) => <StatusPill status={h.isActive ? "active" : "inactive"} label={h.isActive ? "Active" : "Inactive"} />,
    },
  ];
  if (editable) {
    columns.push({
      key: "actions",
      title: "",
      align: "right",
      flex: 0.5,
      render: (h) => (
        <IconButton testID={`rate-edit-${h.id}`} icon={Pencil} label={`Edit ${h.name}`} onPress={() => setDialog({ head: h, group: h.appliesTo })} />
      ),
    });
  }

  const addButton = editable ? (
    <Button testID="rate-add" title="Add charge head" icon={Plus} onPress={() => setDialog({ head: null, group: "freight" })} />
  ) : null;

  const total = list.data?.length ?? 0;

  return (
    <Screen
      title="Rate card"
      subtitle={canEdit ? "Charge heads used to price bookings." : "Charge heads used to price bookings (view only)."}
      back
      backTo="Settings"
      actions={addButton}
      refreshing={list.isRefetching}
      onRefresh={() => list.refetch()}
      testID="rates-screen"
    >
      <Col gap={16}>
        <ReadOnlyBanner />
        {list.isLoading ? (
          <LoadingBlock rows={4} />
        ) : list.error ? (
          <ErrorState message={apiErrorMessage(list.error)} onRetry={() => list.refetch()} />
        ) : total === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No charge heads yet"
            message="Add Freight (per kg) and Hamali (per package) to get quotes on every booking."
            action={addButton}
          />
        ) : (
          GROUPS.filter((g) => grouped[g].length || editable).map((g) => (
            <Col key={g} gap={0} testID={`rate-group-${g}`}>
              <SectionHeader
                title={`${APPLIES_TO_LABEL[g]} · ${grouped[g].length}`}
                action={
                  editable ? (
                    <Button
                      testID={`rate-add-${g}`}
                      title="Add"
                      size="sm"
                      variant="ghost"
                      icon={Plus}
                      onPress={() => setDialog({ head: null, group: g })}
                    />
                  ) : undefined
                }
              />
              {grouped[g].length ? (
                <DataList<ChargeHead>
                  testID={`rate-list-${g}`}
                  rows={grouped[g]}
                  columns={columns}
                  keyOf={(h) => h.id}
                />
              ) : (
                <Text variant="caption" tone="faint">
                  No {APPLIES_TO_LABEL[g].toLowerCase()} heads.
                </Text>
              )}
            </Col>
          ))
        )}
        <QuoteTester />
      </Col>
      {editable ? (
        <HeadDialog
          visible={!!dialog}
          head={dialog?.head ?? null}
          defaultGroup={dialog?.group ?? "freight"}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </Screen>
  );
}
