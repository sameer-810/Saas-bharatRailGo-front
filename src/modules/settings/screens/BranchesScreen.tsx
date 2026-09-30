/** Branches — head office + counters. Owner edits (branches.manage); others view. */
import React, { useState } from "react";
import { View } from "react-native";
import { MapPin, Pencil, Phone, Plus, Power, Store } from "lucide-react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTheme } from "@shared/useTheme";
import {
  Button,
  Card,
  Col,
  Combobox,
  Dialog,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingBlock,
  Row,
  Screen,
  StatusPill,
  Text,
  TextField,
  confirm,
  toast,
} from "@shared/ui";
import { useApiMutation } from "@shared/api/query";
import { apiErrorCode, apiErrorMessage } from "@shared/api/apiClient";
import {
  loadStationOptions,
  useBranches,
  type Branch,
} from "@shared/api/lookups";
import { useCan, useReadOnly } from "@shared/lib/permissions";
import {
  PlanLimitBanner,
  ReadOnlyBanner,
  atLimit,
  usageText,
  useSubscription,
} from "../components/common";

const schema = z.object({
  name: z.string().trim().min(2, "Branch name is required").max(80),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,10}$/, "2–10 letters, digits or dashes"),
  stationCode: z.string().optional(),
  address: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(20).optional(),
});
type Form = z.infer<typeof schema>;

function BranchDialog({
  branch,
  visible,
  onClose,
  onLimit,
}: {
  branch: Branch | null;
  visible: boolean;
  onClose: () => void;
  onLimit: () => void;
}) {
  const isEdit = !!branch;
  const { control, handleSubmit, reset } = useForm<Form>({
    resolver: zodResolver(schema),
    values: {
      name: branch?.name || "",
      code: branch?.code || "",
      stationCode: branch?.stationCode || "",
      address: branch?.address || "",
      phone: branch?.phone || "",
    },
  });
  const create = useApiMutation<Branch, Form>("post", "/branches", {
    invalidate: ["branches"],
  });
  const update = useApiMutation<Branch, { id: string; body: Partial<Form> }>(
    "patch",
    (v) => `/branches/${v.id}`,
    {
      invalidate: ["branches"],
      body: (v) => v.body,
    },
  );

  const close = () => {
    reset();
    onClose();
  };

  const submit = handleSubmit(async (v) => {
    const body: Form = {
      name: v.name,
      code: v.code,
      stationCode: v.stationCode || undefined,
      address: v.address || undefined,
      phone: v.phone || undefined,
    };
    try {
      if (branch) {
        const patch: Partial<Form> = {};
        (Object.keys(body) as (keyof Form)[]).forEach((k) => {
          const next = v[k] ?? "";
          if (
            next !== ((branch[k as keyof Branch] as string | undefined) ?? "")
          )
            patch[k] = next;
        });
        if (Object.keys(patch).length)
          await update.mutateAsync({ id: branch.id, body: patch });
        toast.success("Branch updated");
      } else {
        await create.mutateAsync(body);
        toast.success(`Branch ${v.code} created`);
      }
      close();
    } catch (err) {
      if (apiErrorCode(err) === "PLAN_LIMIT_REACHED") {
        onLimit();
        close();
      }
      toast.error(apiErrorMessage(err));
    }
  });

  return (
    <Dialog
      visible={visible}
      onClose={close}
      title={isEdit ? `Edit ${branch?.name}` : "Add branch"}
      testID="branch-dialog"
      footer={
        <>
          <Button
            testID="branch-cancel"
            title="Cancel"
            variant="secondary"
            onPress={close}
          />
          <Button
            testID="branch-save"
            title={isEdit ? "Save" : "Add branch"}
            loading={create.isPending || update.isPending}
            onPress={submit}
          />
        </>
      }
    >
      <Controller
        control={control}
        name="name"
        render={({ field: f, fieldState }) => (
          <TextField
            testID="branch-name"
            label="Branch name"
            value={f.value}
            onChangeText={f.onChange}
            error={fieldState.error?.message}
            placeholder="e.g. Dadar counter"
          />
        )}
      />
      <Controller
        control={control}
        name="code"
        render={({ field: f, fieldState }) => (
          <TextField
            testID="branch-code"
            label="Code"
            value={f.value}
            onChangeText={(s) => f.onChange(s.toUpperCase())}
            autoCapitalize="characters"
            mono
            maxLength={10}
            hint="Short code printed on bookings, e.g. DDR"
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="stationCode"
        render={({ field: f }) => (
          <Combobox<string>
            testID="branch-station"
            label="Station"
            placeholder="Pick the railway station"
            valueLabel={f.value || undefined}
            selectedValue={f.value || null}
            loadOptions={loadStationOptions}
            onPick={(o) => f.onChange(o ? o.value : "")}
            clearable
          />
        )}
      />
      <Controller
        control={control}
        name="address"
        render={({ field: f, fieldState }) => (
          <TextField
            testID="branch-address"
            label="Address"
            value={f.value}
            onChangeText={f.onChange}
            multiline
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="phone"
        render={({ field: f, fieldState }) => (
          <TextField
            testID="branch-phone"
            label="Phone"
            value={f.value}
            onChangeText={f.onChange}
            keyboardType="phone-pad"
            mono
            error={fieldState.error?.message}
          />
        )}
      />
    </Dialog>
  );
}

function BranchCard({
  b,
  canEdit,
  onEdit,
  onToggle,
}: {
  b: Branch;
  canEdit: boolean;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const t = useTheme();
  return (
    <View style={{ flexGrow: 1, flexBasis: 300, minWidth: 260 }}>
      <Card
        testID={`branch-card-${b.code}`}
        style={{ height: "100%", opacity: b.isActive ? 1 : 0.7 }}
      >
        <Row justify="space-between" align="flex-start" gap={8}>
          <Col gap={4} flex={1}>
            <Row gap={8} wrap>
              <Text variant="h3">{b.name}</Text>
              {b.isHeadOffice ? (
                <View
                  testID={`branch-ho-${b.code}`}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: t.radius.pill,
                    backgroundColor: t.c.accentSoft,
                  }}
                >
                  <Text variant="caption" tone="accent" weight="semibold">
                    HO
                  </Text>
                </View>
              ) : null}
            </Row>
            <Text variant="mono" tone="muted">
              {b.code}
            </Text>
          </Col>
          <StatusPill
            status={b.isActive ? "active" : "inactive"}
            label={b.isActive ? "Active" : "Inactive"}
          />
        </Row>
        <Col gap={6} style={{ marginTop: 12 }}>
          <Row gap={6}>
            <MapPin size={14} color={t.c.textFaint} />
            <Text
              variant="caption"
              tone="muted"
              style={{ fontFamily: b.stationCode ? t.fonts.mono : undefined }}
            >
              {b.stationCode || "No station set"}
            </Text>
          </Row>
          {b.address ? (
            <Text variant="caption" tone="muted" numberOfLines={2}>
              {b.address}
            </Text>
          ) : null}
          {b.phone ? (
            <Row gap={6}>
              <Phone size={14} color={t.c.textFaint} />
              <Text variant="caption" tone="muted">
                {b.phone}
              </Text>
            </Row>
          ) : null}
        </Col>
        {canEdit ? (
          <Row justify="flex-end" gap={0} style={{ marginTop: 8 }}>
            <IconButton
              testID={`branch-edit-${b.code}`}
              icon={Pencil}
              label="Edit branch"
              onPress={onEdit}
            />
            {b.isHeadOffice ? (
              <Text
                variant="caption"
                tone="faint"
                style={{ alignSelf: "center" }}
              >
                Head office is always active
              </Text>
            ) : (
              <IconButton
                testID={`branch-toggle-${b.code}`}
                icon={Power}
                label={b.isActive ? "Deactivate branch" : "Activate branch"}
                tone={b.isActive ? "danger" : "accent"}
                onPress={onToggle}
              />
            )}
          </Row>
        ) : null}
      </Card>
    </View>
  );
}

export function BranchesScreen() {
  const canEdit = useCan("branches.manage");
  const readOnly = useReadOnly();
  const editable = canEdit && !readOnly;
  const list = useBranches(canEdit);
  const { sub } = useSubscription();
  const [dialog, setDialog] = useState<{ branch: Branch | null } | null>(null);
  const [limitHit, setLimitHit] = useState(false);

  const toggle = useApiMutation<Branch, { id: string; isActive: boolean }>(
    "patch",
    (v) => `/branches/${v.id}`,
    {
      invalidate: ["branches"],
      body: (v) => ({ isActive: v.isActive }),
    },
  );

  const used = sub?.usage?.branches;
  const max = sub?.limits?.maxBranches ?? null;
  const full = atLimit(used, max);

  const onToggle = async (b: Branch) => {
    if (b.isActive) {
      const ok = await confirm({
        title: `Deactivate ${b.name}?`,
        message:
          "It disappears from the branch switcher and new bookings. Existing records stay. Staff assigned only to it lose access.",
        confirmLabel: "Deactivate",
        danger: true,
      });
      if (!ok) return;
    }
    try {
      await toggle.mutateAsync({ id: b.id, isActive: !b.isActive });
      toast.success(
        b.isActive ? `${b.name} deactivated` : `${b.name} activated`,
      );
    } catch (err) {
      if (apiErrorCode(err) === "PLAN_LIMIT_REACHED") setLimitHit(true);
      toast.error(apiErrorMessage(err));
    }
  };

  const addButton = canEdit ? (
    <Button
      testID="branch-add"
      title="Add branch"
      icon={Plus}
      disabled={readOnly}
      onPress={() => {
        if (full) {
          setLimitHit(true);
          return;
        }
        setDialog({ branch: null });
      }}
    />
  ) : null;

  const branches = [...(list.data || [])].sort(
    (a, b) =>
      Number(b.isHeadOffice) - Number(a.isHeadOffice) ||
      Number(b.isActive) - Number(a.isActive) ||
      a.name.localeCompare(b.name),
  );

  return (
    <Screen
      title="Branches"
      subtitle={usageText(used, max, "active branches")}
      back
      backTo="Settings"
      actions={addButton}
      refreshing={list.isRefetching}
      onRefresh={() => list.refetch()}
      testID="branches-screen"
    >
      <Col gap={14}>
        <ReadOnlyBanner />
        {!canEdit ? (
          <Text variant="caption" tone="muted">
            Only the owner can add or change branches.
          </Text>
        ) : null}
        {canEdit && (limitHit || full) ? (
          <PlanLimitBanner
            what="branches"
            testID="branch-limit-banner"
            message={
              full
                ? `You are using ${used} of ${max} branches on your plan. Upgrade to open another branch.`
                : undefined
            }
          />
        ) : null}
        {list.isLoading ? (
          <LoadingBlock rows={3} />
        ) : list.error ? (
          <ErrorState
            message={apiErrorMessage(list.error)}
            onRetry={() => list.refetch()}
          />
        ) : !branches.length ? (
          <EmptyState
            icon={Store}
            title="No branches yet"
            message="Your head office is created at signup. Add counters here."
            action={addButton}
          />
        ) : (
          <Row wrap gap={12} align="stretch" testID="branch-list">
            {branches.map((b) => (
              <BranchCard
                key={b.id}
                b={b}
                canEdit={editable}
                onEdit={() => setDialog({ branch: b })}
                onToggle={() => onToggle(b)}
              />
            ))}
          </Row>
        )}
      </Col>
      {canEdit ? (
        <BranchDialog
          visible={!!dialog}
          branch={dialog?.branch ?? null}
          onClose={() => setDialog(null)}
          onLimit={() => setLimitHit(true)}
        />
      ) : null}
    </Screen>
  );
}
