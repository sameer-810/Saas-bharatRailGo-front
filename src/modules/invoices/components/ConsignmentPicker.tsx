/** Selectable list of a party's un-invoiced on-bill consignments, with select-all. */
import React from "react";
import { Pressable, View } from "react-native";
import { Check, PackageOpen } from "lucide-react-native";
import { Col, EmptyState, ErrorState, LoadingBlock, Money, Row, Text } from "@shared/ui";
import { useTheme } from "@shared/useTheme";
import { formatDate } from "@shared/lib/format";
import { routeLabel, serviceOf } from "../lib";
import type { InvoiceConsignment } from "../types";

function Box({ on }: { on: boolean }) {
  const t = useTheme();
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: on ? t.c.accent : t.c.borderStrong,
        backgroundColor: on ? t.c.accent : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {on ? <Check size={14} color={t.c.accentText} /> : null}
    </View>
  );
}

export function ConsignmentPicker({
  items,
  selected,
  onChange,
  loading,
  error,
  onRetry,
  emptyAction,
  testID = "invoice-picker",
}: {
  items: InvoiceConsignment[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyAction?: React.ReactNode;
  testID?: string;
}) {
  const t = useTheme();
  if (error) return <ErrorState message="Could not load this party's bookings." onRetry={onRetry} />;
  if (loading) return <LoadingBlock rows={4} />;
  if (items.length === 0) {
    return (
      <EmptyState
        icon={PackageOpen}
        title="Nothing left to bill"
        message="This party has no on-bill bookings that are not already on an invoice."
        action={emptyAction}
      />
    );
  }

  const allOn = items.every((c) => selected.has(c.id));
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <Col gap={0} testID={testID} style={{ borderWidth: 1, borderColor: t.c.border, borderRadius: t.radius.lg, overflow: "hidden" }}>
      <Pressable
        testID={`${testID}-all`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: allOn }}
        onPress={() => onChange(allOn ? new Set() : new Set(items.map((c) => c.id)))}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: t.c.surfaceAlt }}
      >
        <Box on={allOn} />
        <Text variant="label" style={{ flex: 1 }}>
          {allOn ? "Unselect all" : "Select all"} · {selected.size} of {items.length} selected
        </Text>
      </Pressable>
      {items.map((c) => {
        const on = selected.has(c.id);
        return (
          <Pressable
            key={c.id}
            testID={`${testID}-row-${c.id}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            onPress={() => toggle(c.id)}
            style={({ hovered }: { hovered?: boolean }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 12,
              borderTopWidth: 1,
              borderTopColor: t.c.border,
              backgroundColor: on ? t.c.accentSoft : hovered ? t.c.surfaceAlt : t.c.surface,
            })}
          >
            <Box on={on} />
            <Col gap={2} flex={1}>
              <Row gap={8} wrap>
                <Text variant="bodyStrong">{formatDate(c.date)}</Text>
                <Text style={{ fontFamily: t.fonts.mono }} tone="muted">
                  {routeLabel(c)}
                </Text>
              </Row>
              <Text variant="caption" tone="faint" numberOfLines={1}>
                {[
                  c.railwayReceiptNumber ? `RR ${c.railwayReceiptNumber}` : null,
                  c.packages ? `${c.packages} pkg` : null,
                  c.contents,
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </Text>
            </Col>
            <Col gap={0} align="flex-end">
              <Money value={c.totalAmount} variant="bodyStrong" />
              <Text variant="caption" tone="faint">
                svc <Money value={serviceOf(c)} variant="caption" tone="faint" /> · reimb{" "}
                <Money value={c.reimbursementAmount} variant="caption" tone="faint" />
              </Text>
            </Col>
          </Pressable>
        );
      })}
    </Col>
  );
}
