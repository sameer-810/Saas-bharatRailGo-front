/** Small building blocks shared by the settings screens. */
import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { Plus, X } from "lucide-react-native";
import { useTheme } from "@shared/useTheme";
import { Banner, Button, Col, Row, Text, TextField } from "@shared/ui";
import { useReadOnly } from "@shared/lib/permissions";
import { useAppNav } from "@navigation/useAppNav";
import { useMe } from "@shared/api/lookups";
import { useAuthStore, type Subscription } from "@shared/store/useAuthStore";

/** Freshest subscription summary: /auth/me, falling back to the one stored at login. */
export function useSubscription(): {
  sub: Subscription | null;
  refetch: () => void;
  isLoading: boolean;
} {
  const me = useMe();
  const stored = useAuthStore((s) => s.subscription);
  return {
    sub: me.data?.subscription ?? stored,
    refetch: () => void me.refetch(),
    isLoading: me.isLoading,
  };
}

/** Responsive form grid: children flow 2–3 per row on desktop, 1 per row on phones. */
export function Grid({
  children,
  basis = 260,
}: {
  children: React.ReactNode;
  basis?: number;
}) {
  return (
    <Row wrap gap={14} align="flex-start">
      {React.Children.toArray(children)
        .filter(Boolean)
        .map((child, i) => (
          <View
            key={i}
            style={{ flexGrow: 1, flexBasis: basis, minWidth: 200 }}
          >
            {child}
          </View>
        ))}
    </Row>
  );
}

/** Shown when the subscription is read-only; returns null otherwise. */
export function ReadOnlyBanner() {
  const readOnly = useReadOnly();
  const nav = useAppNav();
  if (!readOnly) return null;
  return (
    <Banner
      testID="settings-readonly-banner"
      tone="danger"
      title="Read-only — your subscription has ended"
      message="You can view everything, but changes are disabled until the plan is renewed."
      action={
        <Pressable
          testID="settings-readonly-plan"
          onPress={() => nav.navigate("Plan")}
        >
          <Text variant="label" tone="accent">
            View plan
          </Text>
        </Pressable>
      }
    />
  );
}

/** PLAN_LIMIT_REACHED explanation with a link to the Plan screen. */
export function PlanLimitBanner({
  what,
  message,
  testID,
}: {
  what: string;
  message?: string;
  testID?: string;
}) {
  const nav = useAppNav();
  return (
    <Banner
      testID={testID ?? "plan-limit-banner"}
      tone="warning"
      title={`Your plan's ${what} limit is reached`}
      message={
        message ||
        `Upgrade the plan, or deactivate one of the existing ${what} first.`
      }
      action={
        <Pressable
          testID={`${testID ?? "plan-limit-banner"}-plan`}
          onPress={() => nav.navigate("Plan")}
        >
          <Text variant="label" tone="accent">
            View plan
          </Text>
        </Pressable>
      }
    />
  );
}

/** "3 of 5 users" style usage label. */
export function usageText(
  used: number | undefined,
  limit: number | null | undefined,
  noun: string,
) {
  const u = used ?? 0;
  if (limit == null) return `${u} ${noun} · Unlimited`;
  return `${u} of ${limit} ${noun}`;
}

export function atLimit(
  used: number | undefined,
  limit: number | null | undefined,
) {
  return limit != null && (used ?? 0) >= limit;
}

/** Progress bar coloured by fill: success < 70 %, warning < 90 %, danger ≥ 90 %. */
export function UsageMeter({
  label,
  used,
  limit,
  testID,
}: {
  label: string;
  used: number;
  limit: number | null;
  testID?: string;
}) {
  const t = useTheme();
  const pct =
    limit == null || limit <= 0
      ? 0
      : Math.min(100, Math.round((used / limit) * 100));
  const color =
    limit === 0
      ? t.c.danger
      : pct >= 90
        ? t.c.danger
        : pct >= 70
          ? t.c.warning
          : t.c.success;
  return (
    <Col gap={6} testID={testID}>
      <Row justify="space-between">
        <Text variant="label">{label}</Text>
        <Text
          variant="mono"
          tone="muted"
          testID={testID ? `${testID}-value` : undefined}
        >
          {limit == null ? `${used} · Unlimited` : `${used} / ${limit}`}
        </Text>
      </Row>
      <View
        style={{
          height: 8,
          borderRadius: 4,
          backgroundColor: t.c.surfaceAlt,
          overflow: "hidden",
        }}
      >
        {limit != null ? (
          <View
            style={{
              height: 8,
              width: `${limit === 0 ? 100 : pct}%`,
              backgroundColor: color,
              borderRadius: 4,
            }}
          />
        ) : null}
      </View>
      {limit != null ? (
        <Text variant="caption" tone="faint">
          {pct}% used
        </Text>
      ) : null}
    </Col>
  );
}

/** Chip with a remove button. */
export function RemovableChip({
  label,
  onRemove,
  testID,
  mono,
}: {
  label: string;
  onRemove?: () => void;
  testID?: string;
  mono?: boolean;
}) {
  const t = useTheme();
  return (
    <Row
      gap={6}
      style={{
        paddingLeft: 12,
        paddingRight: onRemove ? 6 : 12,
        minHeight: 34,
        borderRadius: t.radius.pill,
        borderWidth: 1,
        borderColor: t.c.border,
        backgroundColor: t.c.surfaceAlt,
      }}
    >
      <Text
        variant="label"
        style={mono ? { fontFamily: t.fonts.mono } : undefined}
      >
        {label}
      </Text>
      {onRemove ? (
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label}`}
          onPress={onRemove}
          hitSlop={8}
          style={{ padding: 4 }}
        >
          <X size={14} color={t.c.textMuted} />
        </Pressable>
      ) : null}
    </Row>
  );
}

/**
 * Add/remove a list of short strings (payment receivers, mobile numbers).
 * `validate` returns an error message or null.
 */
export function StringListEditor({
  label,
  value,
  onChange,
  max,
  placeholder,
  hint,
  validate,
  disabled,
  mono,
  keyboardType,
  testID,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
  placeholder?: string;
  hint?: string;
  validate?: (s: string) => string | null;
  disabled?: boolean;
  mono?: boolean;
  keyboardType?: "default" | "phone-pad";
  testID: string;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | undefined>();
  const full = max != null && value.length >= max;

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    const err = validate?.(v);
    if (err) return setError(err);
    if (value.some((x) => x.toLowerCase() === v.toLowerCase()))
      return setError("Already in the list");
    onChange([...value, v]);
    setDraft("");
    setError(undefined);
  };

  return (
    <Col gap={8}>
      <Text variant="label" tone="muted">
        {label}
        {max != null ? ` (${value.length}/${max})` : ""}
      </Text>
      {value.length ? (
        <Row wrap gap={8}>
          {value.map((v, i) => (
            <RemovableChip
              key={v}
              label={v}
              mono={mono}
              testID={`${testID}-remove-${i}`}
              onRemove={
                disabled
                  ? undefined
                  : () => onChange(value.filter((x) => x !== v))
              }
            />
          ))}
        </Row>
      ) : null}
      {!disabled && !full ? (
        <Row gap={8} align="flex-start">
          <View style={{ flex: 1 }}>
            <TextField
              testID={`${testID}-input`}
              value={draft}
              onChangeText={(s) => {
                setDraft(s);
                setError(undefined);
              }}
              placeholder={placeholder}
              onSubmitEditing={add}
              mono={mono}
              keyboardType={keyboardType}
              error={error}
            />
          </View>
          <Button
            testID={`${testID}-add`}
            title="Add"
            icon={Plus}
            variant="secondary"
            onPress={add}
          />
        </Row>
      ) : null}
      {hint ? (
        <Text variant="caption" tone="faint">
          {hint}
        </Text>
      ) : null}
    </Col>
  );
}

/** Title + caption block used at the top of form cards. */
export function CardTitle({
  title,
  caption,
  right,
}: {
  title: string;
  caption?: string;
  right?: React.ReactNode;
}) {
  return (
    <Row
      justify="space-between"
      align="flex-start"
      gap={12}
      style={{ marginBottom: 14 }}
    >
      <Col gap={2} flex={1}>
        <Text variant="h3">{title}</Text>
        {caption ? (
          <Text variant="caption" tone="muted">
            {caption}
          </Text>
        ) : null}
      </Col>
      {right}
    </Row>
  );
}
