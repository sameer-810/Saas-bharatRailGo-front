/**
 * Horizontal delivery-status stepper: received → loaded → in transit → unloaded → delivered,
 * plus a separate "Returned" exit. Tapping a step calls onChange(status).
 */
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Check, Undo2 } from "lucide-react-native";
import { Row, Text } from "@shared/ui";
import { useTheme } from "@shared/useTheme";
import { DELIVERY_FLOW, DELIVERY_LABEL, type DeliveryStatus } from "../lib/types";

export function DeliveryStepper({
  value,
  onChange,
  pending,
  disabled,
  testID = "booking-status",
}: {
  value: DeliveryStatus;
  onChange: (s: DeliveryStatus) => void;
  /** Status currently being saved (shows a spinner on that step). */
  pending?: DeliveryStatus | null;
  disabled?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  const returned = value === "returned";
  const at = DELIVERY_FLOW.indexOf(value as (typeof DELIVERY_FLOW)[number]);

  return (
    <Row gap={12} wrap align="center" testID={testID}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: "center" }}>
        {DELIVERY_FLOW.map((s, i) => {
          const done = !returned && i < at;
          const current = !returned && i === at;
          const color = current
            ? s === "delivered"
              ? t.c.success
              : t.c.accent
            : done
              ? t.c.accent
              : t.c.borderStrong;
          return (
            <Row key={s} gap={0} align="center">
              {i > 0 ? (
                <View
                  style={{
                    width: 28,
                    height: 2,
                    backgroundColor: done || current ? t.c.accent : t.c.border,
                  }}
                />
              ) : null}
              <Pressable
                testID={`${testID}-step-${s}`}
                accessibilityRole="button"
                accessibilityLabel={`Mark ${DELIVERY_LABEL[s]}`}
                accessibilityState={{ selected: current, disabled: !!disabled }}
                disabled={disabled || current || !!pending}
                onPress={() => onChange(s)}
                style={({ hovered }: { hovered?: boolean }) => ({
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 6,
                  paddingVertical: 4,
                  borderRadius: t.radius.md,
                  backgroundColor: hovered && !current ? t.c.surfaceAlt : "transparent",
                })}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2,
                    borderColor: color,
                    backgroundColor: current ? color : done ? t.c.accentSoft : t.c.surface,
                  }}
                >
                  {pending === s ? (
                    <ActivityIndicator size="small" color={current ? t.c.accentText : t.c.accent} />
                  ) : done || (current && s === "delivered") ? (
                    <Check size={14} color={current ? t.c.surface : t.c.accent} />
                  ) : (
                    <Text
                      variant="caption"
                      style={{ fontFamily: t.fonts.mono, color: current ? t.c.accentText : t.c.textMuted }}
                    >
                      {i + 1}
                    </Text>
                  )}
                </View>
                <Text variant="caption" tone={current ? "default" : done ? "muted" : "faint"} weight={current ? "semibold" : undefined}>
                  {DELIVERY_LABEL[s]}
                </Text>
              </Pressable>
            </Row>
          );
        })}
      </ScrollView>
      <Pressable
        testID={`${testID}-step-returned`}
        accessibilityRole="button"
        accessibilityLabel="Mark Returned"
        accessibilityState={{ selected: returned }}
        disabled={disabled || returned || !!pending}
        onPress={() => onChange("returned")}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 12,
          height: 34,
          borderRadius: t.radius.pill,
          borderWidth: 1,
          borderColor: returned ? t.c.danger : t.c.border,
          backgroundColor: returned ? t.c.dangerSoft : "transparent",
        }}
      >
        {pending === "returned" ? (
          <ActivityIndicator size="small" color={t.c.danger} />
        ) : (
          <Undo2 size={14} color={returned ? t.c.danger : t.c.textMuted} />
        )}
        <Text variant="label" tone={returned ? "danger" : "muted"}>
          {returned ? "Returned" : "Mark returned"}
        </Text>
      </Pressable>
    </Row>
  );
}
