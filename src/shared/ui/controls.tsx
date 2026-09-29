/**
 * Interactive controls: Button, IconButton, TextField, SearchInput, Select,
 * Combobox (async search), DateField, SegmentedControl, Toggle.
 * Every control takes a testID so Playwright can drive it (web renders it as
 * data-testid).
 */
import React, { forwardRef, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  Switch,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { Check, ChevronDown, Search, X, type LucideIcon } from "lucide-react-native";
import { useTheme } from "../useTheme";
import { Text, Row, Col } from "./primitives";
import { isoDay, addDays } from "../lib/format";

/* ─────────────────────────── Button ─────────────────────────── */

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  testID?: string;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  icon: Icon,
  loading,
  disabled,
  fullWidth,
  testID,
}: ButtonProps) {
  const t = useTheme();
  const palette = {
    primary: { bg: t.c.accent, fg: t.c.accentText, border: t.c.accent },
    secondary: { bg: t.c.surface, fg: t.c.text, border: t.c.borderStrong },
    ghost: { bg: "transparent", fg: t.c.accent, border: "transparent" },
    danger: { bg: t.c.danger, fg: "#FFFFFF", border: t.c.danger },
  }[variant];
  const h = { sm: 34, md: 44, lg: 52 }[size];
  const off = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
        height: h,
        paddingHorizontal: size === "sm" ? 12 : 18,
        borderRadius: t.radius.md,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.bg,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        opacity: off ? 0.55 : pressed ? 0.85 : 1,
        alignSelf: fullWidth ? "stretch" : "auto",
        transform: [{ translateY: hovered && !off ? -1 : 0 }],
      })}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : Icon ? (
        <Icon size={size === "sm" ? 15 : 18} color={palette.fg} />
      ) : null}
      <Text variant="label" style={{ color: palette.fg, fontSize: size === "lg" ? 15 : 14 }}>
        {title}
      </Text>
    </Pressable>
  );
}

export function IconButton({
  icon: Icon,
  onPress,
  label,
  testID,
  tone = "default",
  size = 40,
}: {
  icon: LucideIcon;
  onPress?: () => void;
  label: string;
  testID?: string;
  tone?: "default" | "danger" | "accent";
  size?: number;
}) {
  const t = useTheme();
  const color = tone === "danger" ? t.c.danger : tone === "accent" ? t.c.accent : t.c.textMuted;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
        width: size,
        height: size,
        borderRadius: t.radius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: hovered || pressed ? t.c.surfaceAlt : "transparent",
      })}
    >
      <Icon size={18} color={color} />
    </Pressable>
  );
}

/* ─────────────────────────── TextField ─────────────────────────── */

export interface TextFieldProps extends Omit<TextInputProps, "style"> {
  label?: string;
  error?: string;
  hint?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  mono?: boolean;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, left, right, mono, multiline, testID, ...rest },
  ref,
) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Col gap={6}>
      {label ? (
        <Text variant="label" tone="muted">
          {label}
        </Text>
      ) : null}
      <Row
        gap={8}
        style={{
          minHeight: multiline ? 88 : 44,
          paddingHorizontal: 12,
          borderRadius: t.radius.md,
          borderWidth: 1,
          borderColor: error ? t.c.danger : focused ? t.c.accent : t.c.border,
          backgroundColor: t.c.surfaceSunken,
          alignItems: multiline ? "flex-start" : "center",
        }}
      >
        {left}
        <TextInput
          ref={ref}
          testID={testID}
          accessibilityLabel={label}
          placeholderTextColor={t.c.textFaint}
          multiline={multiline}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          {...rest}
          style={[
            t.type.body,
            {
              flex: 1,
              color: t.c.text,
              paddingVertical: multiline ? 10 : 0,
              minHeight: multiline ? 80 : 42,
              textAlignVertical: multiline ? "top" : "center",
            },
            mono && { fontFamily: t.fonts.mono },
            Platform.OS === "web" && ({ outlineStyle: "none" } as object),
          ]}
        />
        {right}
      </Row>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="faint">
          {hint}
        </Text>
      ) : null}
    </Col>
  );
});

/** Numeric field that reports numbers (or undefined when empty). */
export function NumberField({
  value,
  onChange,
  ...rest
}: Omit<TextFieldProps, "value" | "onChangeText" | "onChange"> & {
  value: number | undefined | null;
  onChange: (v: number | undefined) => void;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  useEffect(() => {
    if (value == null && text !== "") setText("");
    else if (value != null && Number(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <TextField
      {...rest}
      mono
      keyboardType="decimal-pad"
      inputMode="decimal"
      value={text}
      onChangeText={(s) => {
        const clean = s.replace(/[^0-9.]/g, "");
        setText(clean);
        onChange(clean === "" ? undefined : Number(clean));
      }}
    />
  );
}

export function SearchInput({
  value,
  onChangeText,
  placeholder = "Search",
  testID,
}: {
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <TextField
      testID={testID}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      left={<Search size={16} color={t.c.textFaint} />}
      right={
        value ? (
          <Pressable accessibilityLabel="Clear search" onPress={() => onChangeText("")} hitSlop={8}>
            <X size={16} color={t.c.textFaint} />
          </Pressable>
        ) : null
      }
    />
  );
}

/* ─────────────────────────── Select / Combobox ─────────────────────────── */

export interface Option<V = string> {
  value: V;
  label: string;
  hint?: string;
}

/**
 * Pick from a list. Opens a searchable sheet. For long or remote lists use
 * Combobox with `loadOptions`.
 */
export function Select<V extends string | number = string>({
  label,
  value,
  options,
  onChange,
  placeholder = "Select…",
  error,
  searchable,
  testID,
  clearable,
}: {
  label?: string;
  value: V | null | undefined;
  options: Option<V>[];
  onChange: (v: V | null) => void;
  placeholder?: string;
  error?: string;
  searchable?: boolean;
  testID?: string;
  clearable?: boolean;
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <Combobox<V>
      label={label}
      error={error}
      testID={testID}
      placeholder={placeholder}
      valueLabel={selected?.label}
      options={options}
      searchable={searchable ?? options.length > 8}
      onPick={(o) => onChange(o ? o.value : null)}
      selectedValue={value ?? null}
      clearable={clearable}
    />
  );
}

export function Combobox<V extends string | number = string>({
  label,
  error,
  placeholder = "Select…",
  valueLabel,
  options: staticOptions,
  loadOptions,
  onPick,
  selectedValue,
  searchable = true,
  testID,
  clearable,
  footer,
}: {
  label?: string;
  error?: string;
  placeholder?: string;
  valueLabel?: string;
  options?: Option<V>[];
  /** Remote search: called with the query (debounced). */
  loadOptions?: (q: string) => Promise<Option<V>[]>;
  onPick: (o: Option<V> | null) => void;
  selectedValue?: V | null;
  searchable?: boolean;
  testID?: string;
  clearable?: boolean;
  /** Extra action row at the bottom of the sheet, e.g. "+ New party". */
  footer?: React.ReactNode;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<Option<V>[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !loadOptions) return;
    let alive = true;
    setLoading(true);
    const h = setTimeout(() => {
      loadOptions(q)
        .then((r) => alive && setRemote(r))
        .catch(() => alive && setRemote([]))
        .finally(() => alive && setLoading(false));
    }, 220);
    return () => {
      alive = false;
      clearTimeout(h);
    };
  }, [open, q, loadOptions]);

  const list = useMemo(() => {
    if (loadOptions) return remote || [];
    const all = staticOptions || [];
    if (!q) return all;
    const needle = q.toLowerCase();
    return all.filter(
      (o) => o.label.toLowerCase().includes(needle) || o.hint?.toLowerCase().includes(needle),
    );
  }, [loadOptions, remote, staticOptions, q]);

  return (
    <Col gap={6}>
      {label ? (
        <Text variant="label" tone="muted">
          {label}
        </Text>
      ) : null}
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label || placeholder}
        onPress={() => setOpen(true)}
        style={{
          minHeight: 44,
          paddingHorizontal: 12,
          borderRadius: t.radius.md,
          borderWidth: 1,
          borderColor: error ? t.c.danger : t.c.border,
          backgroundColor: t.c.surfaceSunken,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Text style={{ flex: 1 }} tone={valueLabel ? "default" : "faint"} numberOfLines={1}>
          {valueLabel || placeholder}
        </Text>
        {clearable && valueLabel ? (
          <Pressable accessibilityLabel="Clear" hitSlop={8} onPress={() => onPick(null)}>
            <X size={16} color={t.c.textFaint} />
          </Pressable>
        ) : (
          <ChevronDown size={16} color={t.c.textFaint} />
        )}
      </Pressable>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: t.c.overlay, justifyContent: "center", padding: 16 }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            onPress={() => undefined}
            style={{
              alignSelf: "center",
              width: "100%",
              maxWidth: 480,
              maxHeight: "80%",
              backgroundColor: t.c.surface,
              borderRadius: t.radius.lg,
              borderWidth: 1,
              borderColor: t.c.border,
              overflow: "hidden",
            }}
          >
            <View style={{ padding: 12, gap: 8 }}>
              <Text variant="h3">{label || placeholder}</Text>
              {searchable || loadOptions ? (
                <SearchInput
                  testID={testID ? `${testID}-search` : undefined}
                  value={q}
                  onChangeText={setQ}
                  placeholder="Type to search"
                />
              ) : null}
            </View>
            {loading ? <ActivityIndicator style={{ padding: 16 }} color={t.c.accent} /> : null}
            <FlatList
              data={list}
              keyExtractor={(o) => String(o.value)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                !loading ? (
                  <Text tone="faint" style={{ padding: 16 }}>
                    Nothing found
                  </Text>
                ) : null
              }
              renderItem={({ item }) => {
                const active = item.value === selectedValue;
                return (
                  <Pressable
                    testID={testID ? `${testID}-option-${item.value}` : undefined}
                    accessibilityRole="button"
                    onPress={() => {
                      onPick(item);
                      setOpen(false);
                      setQ("");
                    }}
                    style={({ hovered }: { hovered?: boolean }) => ({
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      backgroundColor: active ? t.c.accentSoft : hovered ? t.c.surfaceAlt : "transparent",
                    })}
                  >
                    <Col gap={2} flex={1}>
                      <Text>{item.label}</Text>
                      {item.hint ? (
                        <Text variant="caption" tone="faint">
                          {item.hint}
                        </Text>
                      ) : null}
                    </Col>
                    {active ? <Check size={16} color={t.c.accent} /> : null}
                  </Pressable>
                );
              }}
            />
            {footer ? <View style={{ borderTopWidth: 1, borderTopColor: t.c.border, padding: 8 }}>{footer}</View> : null}
          </Pressable>
        </Pressable>
      </Modal>
    </Col>
  );
}

/* ─────────────────────────── DateField ─────────────────────────── */

/**
 * YYYY-MM-DD date input with quick chips. On web it is a native date picker;
 * on phones a validated text field + Today / Yesterday chips.
 */
export function DateField({
  label,
  value,
  onChange,
  error,
  testID,
  quick = true,
}: {
  label?: string;
  value: string | undefined;
  onChange: (v: string) => void;
  error?: string;
  testID?: string;
  quick?: boolean;
}) {
  const t = useTheme();
  const today = isoDay();
  const yesterday = isoDay(addDays(new Date(), -1));
  const chips = quick ? (
    <Row gap={6}>
      {[
        ["Today", today],
        ["Yesterday", yesterday],
      ].map(([l, v]) => (
        <Pressable
          key={l}
          onPress={() => onChange(v)}
          style={{
            paddingHorizontal: 10,
            height: 28,
            justifyContent: "center",
            borderRadius: t.radius.pill,
            backgroundColor: value === v ? t.c.accentSoft : t.c.surfaceAlt,
          }}
        >
          <Text variant="caption" tone={value === v ? "accent" : "muted"}>
            {l}
          </Text>
        </Pressable>
      ))}
    </Row>
  ) : null;

  if (Platform.OS === "web") {
    return (
      <Col gap={6}>
        {label ? (
          <Text variant="label" tone="muted">
            {label}
          </Text>
        ) : null}
        {React.createElement("input", {
          type: "date",
          "data-testid": testID,
          "aria-label": label,
          value: value || "",
          onChange: (e: { target: { value: string } }) => onChange(e.target.value),
          style: {
            height: 44,
            padding: "0 12px",
            borderRadius: t.radius.md,
            border: `1px solid ${error ? t.c.danger : t.c.border}`,
            background: t.c.surfaceSunken,
            color: t.c.text,
            fontFamily: t.fonts.regular,
            fontSize: 15,
            colorScheme: t.isDark ? "dark" : "light",
          },
        })}
        {chips}
        {error ? (
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        ) : null}
      </Col>
    );
  }
  return (
    <Col gap={6}>
      <TextField
        label={label}
        testID={testID}
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
        mono
        error={error}
      />
      {chips}
    </Col>
  );
}

/* ─────────────────────────── Segmented / Toggle ─────────────────────────── */

export function SegmentedControl<V extends string>({
  value,
  options,
  onChange,
  testID,
}: {
  value: V;
  options: Option<V>[];
  onChange: (v: V) => void;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Row
      gap={4}
      testID={testID}
      style={{
        padding: 4,
        borderRadius: t.radius.md,
        backgroundColor: t.c.surfaceAlt,
        alignSelf: "flex-start",
        flexWrap: "wrap",
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={testID ? `${testID}-${o.value}` : undefined}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={{
              paddingHorizontal: 12,
              height: 32,
              justifyContent: "center",
              borderRadius: t.radius.sm,
              backgroundColor: active ? t.c.surface : "transparent",
              borderWidth: active ? 1 : 0,
              borderColor: t.c.border,
            }}
          >
            <Text variant="label" tone={active ? "default" : "muted"}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </Row>
  );
}

export function Toggle({
  label,
  value,
  onChange,
  hint,
  testID,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Row justify="space-between" gap={12}>
      <Col gap={2} flex={1}>
        <Text variant="bodyStrong">{label}</Text>
        {hint ? (
          <Text variant="caption" tone="faint">
            {hint}
          </Text>
        ) : null}
      </Col>
      <Switch
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: t.c.accent, false: t.c.borderStrong }}
        thumbColor="#FFFFFF"
      />
    </Row>
  );
}
