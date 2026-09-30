/** Shared report pieces: date-range filter bar, Excel export button, summary tile row. */
import React, { useState } from "react";
import { View } from "react-native";
import { Download } from "lucide-react-native";
import {
  Button,
  Card,
  Chip,
  Col,
  DateField,
  Row,
  Skeleton,
  Text,
  toast,
} from "@shared/ui";
import { useLayout, useTheme } from "@shared/useTheme";
import { downloadFile } from "@shared/api/files";
import { apiErrorMessage } from "@shared/api/apiClient";
import { presetRange, type DateRange, type RangePreset } from "../types";

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "lastMonth", label: "Last month" },
];

export function rangeError(r: DateRange): string | undefined {
  if (!r.startDate || !r.endDate) return "Pick both dates";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(r.startDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(r.endDate)
  )
    return "Use YYYY-MM-DD";
  if (r.startDate > r.endDate) return "Start date is after end date";
  return undefined;
}

export function DateRangeBar({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
}) {
  const { isPhone } = useLayout();
  const active = PRESETS.find((p) => {
    const r = presetRange(p.key);
    return r.startDate === value.startDate && r.endDate === value.endDate;
  })?.key;
  const err = rangeError(value);
  return (
    <Card testID="report-filters" padding={14}>
      <Col gap={12}>
        <Row gap={8} wrap>
          {PRESETS.map((p) => (
            <Chip
              key={p.key}
              label={p.label}
              selected={active === p.key}
              onPress={() => onChange(presetRange(p.key))}
              testID={`range-${p.key}`}
            />
          ))}
        </Row>
        <Row gap={12} align="flex-start" wrap={isPhone}>
          <View style={{ flex: 1, minWidth: 150 }}>
            <DateField
              label="From"
              value={value.startDate}
              onChange={(v) => onChange({ ...value, startDate: v })}
              quick={false}
              testID="report-start"
            />
          </View>
          <View style={{ flex: 1, minWidth: 150 }}>
            <DateField
              label="To"
              value={value.endDate}
              onChange={(v) => onChange({ ...value, endDate: v })}
              quick={false}
              testID="report-end"
            />
          </View>
        </Row>
        {err ? (
          <Text variant="caption" tone="danger" testID="report-range-error">
            {err}
          </Text>
        ) : null}
      </Col>
    </Card>
  );
}

export function ExportButton({
  url,
  filename,
  params,
  disabled,
}: {
  url: string;
  filename: string;
  params?: Record<string, unknown>;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      title="Export Excel"
      icon={Download}
      variant="secondary"
      loading={busy}
      disabled={disabled}
      testID="report-export"
      onPress={async () => {
        setBusy(true);
        try {
          await downloadFile(url, filename, params);
          toast.success("Excel file ready");
        } catch (err) {
          toast.error(apiErrorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

/** Compact summary figure. */
export function Figure({
  label,
  children,
  hint,
  loading,
  testID,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  loading?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  const { isPhone } = useLayout();
  return (
    <View
      testID={testID}
      style={{
        flexGrow: 1,
        flexBasis: isPhone ? 140 : 170,
        backgroundColor: t.c.surface,
        borderWidth: 1,
        borderColor: t.c.border,
        borderRadius: t.radius.lg,
        padding: 14,
        gap: 6,
      }}
    >
      <Text variant="overline" tone="muted" numberOfLines={1}>
        {label}
      </Text>
      {loading ? <Skeleton height={24} width="70%" /> : children}
      {hint ? (
        <Text variant="caption" tone="faint" numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function FigureRow({ children }: { children: React.ReactNode }) {
  return (
    <Row wrap gap={12} align="stretch" testID="report-summary">
      {children}
    </Row>
  );
}

export function MonoNum({
  value,
  strong,
}: {
  value: React.ReactNode;
  strong?: boolean;
}) {
  const t = useTheme();
  return (
    <Text
      variant={strong ? "h2" : "body"}
      style={{
        fontFamily: strong ? t.fonts.monoBold : t.fonts.mono,
        fontVariant: ["tabular-nums"],
      }}
    >
      {value}
    </Text>
  );
}
