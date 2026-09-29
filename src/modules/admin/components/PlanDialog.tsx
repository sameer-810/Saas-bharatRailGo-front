/** Create / edit a plan. Mirrors plan.validation.js (code only on create). */
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Button, Col, Dialog, NumberField, Row, Text, TextField, Toggle, toast } from "@shared/ui";
import { apiErrorMessage } from "@shared/api/apiClient";
import { adminActions, useAdminMutation, type Limits, type Plan, type PlanInput } from "../api";

interface FormState {
  code: string;
  name: string;
  description: string;
  priceMonthly: number | undefined;
  priceYearly: number | undefined;
  features: string;
  maxUsers: number | undefined;
  maxBranches: number | undefined;
  maxBookingsPerMonth: number | undefined;
  isTrial: boolean;
  isPublic: boolean;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number | undefined;
}

const EMPTY: FormState = {
  code: "",
  name: "",
  description: "",
  priceMonthly: undefined,
  priceYearly: undefined,
  features: "",
  maxUsers: undefined,
  maxBranches: undefined,
  maxBookingsPerMonth: undefined,
  isTrial: false,
  isPublic: true,
  isActive: true,
  isFeatured: false,
  sortOrder: 0,
};

function fromPlan(p: Plan): FormState {
  return {
    code: p.code,
    name: p.name,
    description: p.description ?? "",
    priceMonthly: p.priceMonthly,
    priceYearly: p.priceYearly,
    features: (p.features ?? []).join("\n"),
    maxUsers: p.limits.maxUsers ?? undefined,
    maxBranches: p.limits.maxBranches ?? undefined,
    maxBookingsPerMonth: p.limits.maxBookingsPerMonth ?? undefined,
    isTrial: p.isTrial,
    isPublic: p.isPublic,
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    sortOrder: p.sortOrder,
  };
}

type Errors = Partial<Record<keyof FormState, string>>;

function validate(f: FormState, creating: boolean): Errors {
  const e: Errors = {};
  if (creating && !/^[a-z0-9-]{2,30}$/.test(f.code.trim().toLowerCase())) {
    e.code = "2-30 lowercase letters, digits or dashes";
  }
  if (!f.name.trim()) e.name = "Name is required";
  else if (f.name.trim().length > 60) e.name = "At most 60 characters";
  if (f.description.trim().length > 200) e.description = "At most 200 characters";
  if (f.priceMonthly == null) e.priceMonthly = "Required (0 for free)";
  if (f.priceYearly == null) e.priceYearly = "Required (0 for free)";
  const feats = splitFeatures(f.features);
  if (feats.length > 20) e.features = "At most 20 features";
  else if (feats.some((x) => x.length > 80)) e.features = "Each feature at most 80 characters";
  return e;
}

function splitFeatures(s: string) {
  return s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function PlanDialog({ plan, visible, onClose }: { plan: Plan | null; visible: boolean; onClose: () => void }) {
  const creating = !plan;
  const [f, setF] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const save = useAdminMutation((body: PlanInput) =>
    plan ? adminActions.updatePlan(plan.id, body) : adminActions.createPlan(body),
  );

  useEffect(() => {
    if (!visible) return;
    setF(plan ? fromPlan(plan) : EMPTY);
    setErrors({});
  }, [visible, plan]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const int = (v: number | undefined) => (v == null ? null : Math.floor(v));

  const submit = async () => {
    const e = validate(f, creating);
    setErrors(e);
    if (Object.keys(e).length) return;
    const limits: Limits = {
      maxUsers: int(f.maxUsers),
      maxBranches: int(f.maxBranches),
      maxBookingsPerMonth: int(f.maxBookingsPerMonth),
    };
    const body: PlanInput = {
      name: f.name.trim(),
      description: f.description.trim(),
      priceMonthly: f.priceMonthly ?? 0,
      priceYearly: f.priceYearly ?? 0,
      features: splitFeatures(f.features),
      limits,
      isTrial: f.isTrial,
      isPublic: f.isPublic,
      isActive: f.isActive,
      isFeatured: f.isFeatured,
      sortOrder: int(f.sortOrder) ?? 0,
    };
    if (creating) body.code = f.code.trim().toLowerCase();
    try {
      await save.mutateAsync(body);
      toast.success(creating ? `Plan ${body.code} created` : `Plan ${plan?.code} updated`);
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const half = { flexGrow: 1, flexBasis: 180 } as const;

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title={creating ? "New plan" : `Edit plan · ${plan?.code}`}
      width={620}
      testID="admin-plan-dialog"
      footer={
        <>
          <Button title="Cancel" variant="secondary" onPress={onClose} testID="admin-plan-cancel" />
          <Button title={creating ? "Create plan" : "Save plan"} loading={save.isPending} onPress={submit} testID="admin-plan-save" />
        </>
      }
    >
      <Row gap={12} wrap align="flex-start">
        {creating ? (
          <View style={half}>
            <TextField
              testID="admin-plan-code"
              label="Code"
              value={f.code}
              onChangeText={(v) => set("code", v.toLowerCase())}
              autoCapitalize="none"
              mono
              error={errors.code}
              hint="Permanent. e.g. growth, pro-yearly"
            />
          </View>
        ) : null}
        <View style={half}>
          <TextField testID="admin-plan-name" label="Name" value={f.name} onChangeText={(v) => set("name", v)} error={errors.name} />
        </View>
      </Row>
      <TextField
        testID="admin-plan-description"
        label="Description"
        value={f.description}
        onChangeText={(v) => set("description", v)}
        error={errors.description}
        maxLength={200}
      />
      <Row gap={12} wrap align="flex-start">
        <View style={half}>
          <NumberField
            testID="admin-plan-price-monthly"
            label="Price / month (₹)"
            value={f.priceMonthly}
            onChange={(v) => set("priceMonthly", v)}
            error={errors.priceMonthly}
          />
        </View>
        <View style={half}>
          <NumberField
            testID="admin-plan-price-yearly"
            label="Price / year (₹)"
            value={f.priceYearly}
            onChange={(v) => set("priceYearly", v)}
            error={errors.priceYearly}
          />
        </View>
      </Row>
      <Col gap={4}>
        <Text variant="label" tone="muted">
          Limits
        </Text>
        <Text variant="caption" tone="faint">
          Leave empty for unlimited.
        </Text>
      </Col>
      <Row gap={12} wrap align="flex-start">
        <View style={{ flexGrow: 1, flexBasis: 150 }}>
          <NumberField testID="admin-plan-max-users" label="Users" value={f.maxUsers} onChange={(v) => set("maxUsers", v)} placeholder="Unlimited" />
        </View>
        <View style={{ flexGrow: 1, flexBasis: 150 }}>
          <NumberField testID="admin-plan-max-branches" label="Branches" value={f.maxBranches} onChange={(v) => set("maxBranches", v)} placeholder="Unlimited" />
        </View>
        <View style={{ flexGrow: 1, flexBasis: 150 }}>
          <NumberField
            testID="admin-plan-max-bookings"
            label="Bookings / month"
            value={f.maxBookingsPerMonth}
            onChange={(v) => set("maxBookingsPerMonth", v)}
            placeholder="Unlimited"
          />
        </View>
      </Row>
      <TextField
        testID="admin-plan-features"
        label="Features (one per line)"
        value={f.features}
        onChangeText={(v) => set("features", v)}
        multiline
        error={errors.features}
      />
      <Col gap={12}>
        <Toggle testID="admin-plan-is-active" label="Active" hint="Can be assigned to agencies" value={f.isActive} onChange={(v) => set("isActive", v)} />
        <Toggle testID="admin-plan-is-public" label="Public" hint="Shown on the pricing page" value={f.isPublic} onChange={(v) => set("isPublic", v)} />
        <Toggle testID="admin-plan-is-featured" label="Featured" hint="Highlighted on the pricing page" value={f.isFeatured} onChange={(v) => set("isFeatured", v)} />
        <Toggle testID="admin-plan-is-trial" label="Trial plan" hint="Used for free trials" value={f.isTrial} onChange={(v) => set("isTrial", v)} />
      </Col>
      <View style={{ maxWidth: 180 }}>
        <NumberField testID="admin-plan-sort-order" label="Sort order" value={f.sortOrder} onChange={(v) => set("sortOrder", v)} />
      </View>
    </Dialog>
  );
}
