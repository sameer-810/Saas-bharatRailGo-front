/**
 * Primitive building blocks: Text, Row/Col, Card, Divider, Chip, StatusPill,
 * Money, Badge. All colours come from useTheme().
 */
import React from "react";
import {
  Pressable,
  Text as RNText,
  View,
  type StyleProp,
  type TextProps as RNTextProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../useTheme";
import { STATUS_TONE, type TypeVariant } from "../theme";
import { formatMoney } from "../lib/format";

type Tone =
  | "default"
  | "muted"
  | "faint"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "inverse";

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  tone?: Tone;
  align?: "left" | "center" | "right";
  weight?: "regular" | "medium" | "semibold";
}

export function Text({
  variant = "body",
  tone = "default",
  align,
  weight,
  style,
  ...rest
}: TextProps) {
  const t = useTheme();
  const color = {
    default: t.c.text,
    muted: t.c.textMuted,
    faint: t.c.textFaint,
    accent: t.c.accent,
    success: t.c.success,
    warning: t.c.warning,
    danger: t.c.danger,
    info: t.c.info,
    inverse: t.c.accentText,
  }[tone];
  const w = weight ? { fontFamily: t.fonts[weight] } : null;
  return (
    <RNText
      {...rest}
      style={[
        t.type[variant] as TextStyle,
        { color },
        align && { textAlign: align },
        w,
        style,
      ]}
    />
  );
}

interface StackProps extends ViewProps {
  gap?: number;
  align?: ViewStyle["alignItems"];
  justify?: ViewStyle["justifyContent"];
  wrap?: boolean;
  flex?: number;
  padding?: number;
}

export function Row({
  gap = 8,
  align = "center",
  justify,
  wrap,
  flex,
  padding,
  style,
  ...rest
}: StackProps) {
  return (
    <View
      {...rest}
      style={[
        {
          flexDirection: "row",
          gap,
          alignItems: align,
          justifyContent: justify,
          flex,
          padding,
        },
        wrap && { flexWrap: "wrap" },
        style,
      ]}
    />
  );
}

export function Col({
  gap = 8,
  align,
  justify,
  flex,
  padding,
  style,
  ...rest
}: StackProps) {
  return (
    <View
      {...rest}
      style={[
        { gap, alignItems: align, justifyContent: justify, flex, padding },
        style,
      ]}
    />
  );
}

export interface CardProps extends ViewProps {
  padding?: number;
  onPress?: () => void;
  tone?: "default" | "accent" | "sunken";
}

export function Card({
  padding = 16,
  onPress,
  tone = "default",
  style,
  children,
  ...rest
}: CardProps) {
  const t = useTheme();
  const bg =
    tone === "accent"
      ? t.c.accentSoft
      : tone === "sunken"
        ? t.c.surfaceAlt
        : t.c.surface;
  const base: StyleProp<ViewStyle> = [
    {
      backgroundColor: bg,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      borderColor: t.c.border,
      padding,
    },
    style,
  ];
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({
          pressed,
          hovered,
        }: {
          pressed: boolean;
          hovered?: boolean;
        }) => [
          base,
          (hovered || pressed) && { borderColor: t.c.borderStrong },
          pressed && { opacity: 0.9 },
        ]}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View {...rest} style={base}>
      {children}
    </View>
  );
}

export function Divider({
  vertical,
  style,
}: {
  vertical?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        vertical
          ? { width: 1, alignSelf: "stretch" }
          : { height: 1, alignSelf: "stretch" },
        { backgroundColor: t.c.border },
        style,
      ]}
    />
  );
}

export function Chip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        minHeight: 34,
        justifyContent: "center",
        borderRadius: t.radius.pill,
        borderWidth: 1,
        borderColor: selected ? t.c.accent : t.c.border,
        backgroundColor: selected ? t.c.accentSoft : t.c.surface,
      }}
    >
      <Text variant="label" tone={selected ? "accent" : "muted"}>
        {label}
      </Text>
    </Pressable>
  );
}

const TONE_KEYS = {
  success: ["success", "successSoft"],
  warning: ["warning", "warningSoft"],
  danger: ["danger", "dangerSoft"],
  info: ["info", "infoSoft"],
  neutral: ["textMuted", "surfaceAlt"],
} as const;

/** Status pill — one colour vocabulary for every status in the app (theme.STATUS_TONE). */
export function StatusPill({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const t = useTheme();
  const tone = STATUS_TONE[status] ?? "neutral";
  const [fg, bg] = TONE_KEYS[tone];
  return (
    <View
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: t.radius.pill,
        backgroundColor: t.c[bg],
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: t.c[fg],
        }}
      />
      <Text variant="label" style={{ color: t.c[fg] }}>
        {label ?? humanize(status)}
      </Text>
    </View>
  );
}

export function humanize(s: string) {
  return String(s || "")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** Rupees in the monospace face with tabular figures. */
export function Money({
  value,
  variant = "money",
  tone,
  style,
  compact,
}: {
  value: number | null | undefined;
  variant?: TypeVariant;
  tone?: Tone;
  style?: StyleProp<TextStyle>;
  compact?: boolean;
}) {
  const t = useTheme();
  return (
    <Text
      variant={variant}
      tone={tone}
      style={[
        { fontFamily: t.fonts.mono, fontVariant: ["tabular-nums"] },
        style,
      ]}
    >
      {formatMoney(value, { compact })}
    </Text>
  );
}

/** Small count / label badge. */
export function Badge({
  children,
  tone = "accent",
}: {
  children: React.ReactNode;
  tone?: "accent" | "danger";
}) {
  const t = useTheme();
  return (
    <View
      style={{
        minWidth: 20,
        height: 20,
        paddingHorizontal: 6,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tone === "danger" ? t.c.danger : t.c.accent,
      }}
    >
      <Text
        variant="caption"
        style={{ color: tone === "danger" ? "#fff" : t.c.accentText }}
      >
        {children}
      </Text>
    </View>
  );
}
