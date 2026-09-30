/** Delivery-status stepper: received → loaded → in transit → unloaded → delivered (+ returned). */
import React from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Check, Undo2 } from "lucide-react-native";
import { Button, Col, Row, Text } from "@shared/ui";
import { useLayout, useTheme } from "@shared/useTheme";
import { STATUS_FLOW, STATUS_LABEL, type DeliveryStatus } from "../types";

export function StatusStepper({
  status,
  onChange,
  busy,
  pending,
  disabled,
}: {
  status: DeliveryStatus;
  onChange: (s: DeliveryStatus) => void;
  busy?: boolean;
  pending?: DeliveryStatus | null;
  disabled?: boolean;
}) {
  const t = useTheme();
  const { isPhone } = useLayout();
  const returned = status === "returned";
  const idx = STATUS_FLOW.indexOf(status);

  return (
    <Col gap={12} testID="bilti-stepper">
      <View
        style={{
          flexDirection: isPhone ? "column" : "row",
          gap: isPhone ? 6 : 0,
        }}
      >
        {STATUS_FLOW.map((s, i) => {
          const done = !returned && i < idx;
          const current = !returned && i === idx;
          const color = current
            ? t.c.accent
            : done
              ? t.c.success
              : t.c.borderStrong;
          const loading = busy && pending === s;
          return (
            <Pressable
              key={s}
              testID={`bilti-step-${s}`}
              accessibilityRole="button"
              accessibilityState={{
                selected: current,
                disabled: disabled || busy,
              }}
              accessibilityLabel={`Mark ${STATUS_LABEL[s]}`}
              disabled={disabled || busy || current}
              onPress={() => onChange(s)}
              style={({ hovered }: { hovered?: boolean }) => ({
                flex: isPhone ? undefined : 1,
                flexDirection: isPhone ? "row" : "column",
                alignItems: "center",
                gap: 8,
                paddingVertical: 8,
                paddingHorizontal: 6,
                borderRadius: t.radius.md,
                backgroundColor:
                  hovered && !current && !disabled
                    ? t.c.surfaceAlt
                    : "transparent",
              })}
            >
              <Row
                gap={0}
                style={{ width: isPhone ? undefined : "100%" }}
                justify="center"
              >
                {!isPhone ? (
                  <View
                    style={{
                      flex: 1,
                      height: 2,
                      backgroundColor:
                        i === 0
                          ? "transparent"
                          : done || current
                            ? t.c.success
                            : t.c.border,
                    }}
                  />
                ) : null}
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2,
                    borderColor: color,
                    backgroundColor: done
                      ? t.c.success
                      : current
                        ? t.c.accent
                        : t.c.surface,
                  }}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={t.c.accent} />
                  ) : done ? (
                    <Check size={14} color={t.c.accentText} />
                  ) : (
                    <Text
                      variant="caption"
                      style={{
                        color: current ? t.c.accentText : t.c.textMuted,
                        fontFamily: t.fonts.mono,
                      }}
                    >
                      {i + 1}
                    </Text>
                  )}
                </View>
                {!isPhone ? (
                  <View
                    style={{
                      flex: 1,
                      height: 2,
                      backgroundColor:
                        i === STATUS_FLOW.length - 1
                          ? "transparent"
                          : done
                            ? t.c.success
                            : t.c.border,
                    }}
                  />
                ) : null}
              </Row>
              <Text
                variant="label"
                tone={current ? "accent" : done ? "default" : "muted"}
                align="center"
              >
                {STATUS_LABEL[s]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Row justify="space-between" wrap gap={8}>
        <Text variant="caption" tone="faint">
          {returned
            ? "This bilti was returned. Pick a step to reopen it."
            : "Tap a step to update. Customers get an SMS where configured."}
        </Text>
        {!returned ? (
          <Button
            testID="bilti-step-returned"
            title="Mark returned"
            size="sm"
            variant="ghost"
            icon={Undo2}
            disabled={disabled || busy}
            loading={busy && pending === "returned"}
            onPress={() => onChange("returned")}
          />
        ) : null}
      </Row>
    </Col>
  );
}
