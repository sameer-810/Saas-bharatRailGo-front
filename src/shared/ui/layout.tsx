/**
 * Page-level layout + feedback: Screen, SectionHeader, KeyValue, StatTile,
 * EmptyState, ErrorState, Skeleton, Banner, Dialog, DataList (+ Pagination).
 */
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Info,
  type LucideIcon,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { useLayout, useTheme } from "../useTheme";
import { Card, Col, Row, Text } from "./primitives";
import { Button, IconButton } from "./controls";
import type { Paging } from "../api/apiClient";

/* ─────────────────────────── Screen ─────────────────────────── */

export interface ScreenProps {
  title?: string;
  subtitle?: string;
  /** Show a back arrow (goes back, or to `backTo` route when there is no history). */
  back?: boolean;
  backTo?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
  maxWidth?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  testID?: string;
}

export function Screen({
  title,
  subtitle,
  back,
  backTo,
  actions,
  children,
  scroll = true,
  maxWidth = 1240,
  refreshing,
  onRefresh,
  testID,
}: ScreenProps) {
  const t = useTheme();
  const { isPhone } = useLayout();
  const nav = useNavigation<{
    canGoBack: () => boolean;
    goBack: () => void;
    navigate: (r: string) => void;
  }>();
  const pad = isPhone ? 16 : 28;

  const header =
    title || actions ? (
      <Row
        justify="space-between"
        align="flex-start"
        wrap
        gap={12}
        style={{ marginBottom: 20 }}
      >
        <Row gap={8} align="center" style={{ flexShrink: 1 }}>
          {back ? (
            <IconButton
              icon={ChevronLeft}
              label="Back"
              testID="screen-back"
              onPress={() =>
                nav.canGoBack() ? nav.goBack() : backTo && nav.navigate(backTo)
              }
            />
          ) : null}
          <Col gap={2} style={{ flexShrink: 1 }}>
            {title ? (
              <Text
                variant={isPhone ? "h2" : "h1"}
                accessibilityRole="header"
                testID="screen-title"
              >
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text variant="caption" tone="muted">
                {subtitle}
              </Text>
            ) : null}
          </Col>
        </Row>
        {actions ? (
          <Row gap={8} wrap>
            {actions}
          </Row>
        ) : null}
      </Row>
    ) : null;

  const inner = (
    <View
      style={{
        width: "100%",
        maxWidth,
        alignSelf: "center",
        padding: pad,
        paddingBottom: pad + 40,
      }}
    >
      {header}
      {children}
    </View>
  );

  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: t.c.bg }}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} />
            ) : undefined
          }
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </View>
  );
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <Row justify="space-between" style={{ marginTop: 8, marginBottom: 10 }}>
      <Text variant="overline" tone="muted">
        {title}
      </Text>
      {action}
    </Row>
  );
}

/** Label/value pairs in a responsive grid (detail screens). */
export function KeyValue({
  items,
  columns,
}: {
  items: [string, React.ReactNode][];
  columns?: number;
}) {
  const { isPhone } = useLayout();
  const cols = columns ?? (isPhone ? 2 : 3);
  return (
    <Row wrap gap={0} align="flex-start">
      {items.map(([k, v]) => (
        <Col
          key={k}
          gap={2}
          style={{
            width: `${100 / cols}%`,
            paddingVertical: 8,
            paddingRight: 12,
          }}
        >
          <Text variant="caption" tone="faint">
            {k}
          </Text>
          {typeof v === "string" || typeof v === "number" ? (
            <Text>{String(v)}</Text>
          ) : (
            (v ?? <Text>—</Text>)
          )}
        </Col>
      ))}
    </Row>
  );
}

/* ─────────────────────────── Stat tile ─────────────────────────── */

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  onPress,
  testID,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
  onPress?: () => void;
  testID?: string;
}) {
  const t = useTheme();
  const accent = {
    default: t.c.accent,
    success: t.c.success,
    warning: t.c.warning,
    danger: t.c.danger,
  }[tone];
  return (
    <Card
      onPress={onPress}
      testID={testID}
      style={{ flexGrow: 1, flexBasis: 200, minWidth: 160 }}
    >
      <Row justify="space-between">
        <Text variant="overline" tone="muted">
          {label}
        </Text>
        {Icon ? <Icon size={16} color={accent} /> : null}
      </Row>
      <View style={{ marginTop: 10 }}>
        {typeof value === "string" || typeof value === "number" ? (
          <Text
            variant="h1"
            style={{ fontFamily: t.fonts.mono, fontVariant: ["tabular-nums"] }}
          >
            {value}
          </Text>
        ) : (
          value
        )}
      </View>
      {hint ? (
        <Text variant="caption" tone="faint" style={{ marginTop: 4 }}>
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}

/* ─────────────────────────── States ─────────────────────────── */

export function EmptyState({
  title,
  message,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  message?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
}) {
  const t = useTheme();
  return (
    <Col
      align="center"
      gap={10}
      style={{ paddingVertical: 48, paddingHorizontal: 16 }}
      testID="empty-state"
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: t.c.accentSoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={24} color={t.c.accent} />
      </View>
      <Text variant="h3" align="center">
        {title}
      </Text>
      {message ? (
        <Text tone="muted" align="center" style={{ maxWidth: 420 }}>
          {message}
        </Text>
      ) : null}
      {action}
    </Col>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="Could not load this"
      message={message}
      action={
        onRetry ? (
          <Button title="Try again" variant="secondary" onPress={onRetry} />
        ) : undefined
      }
    />
  );
}

export function Skeleton({
  height = 16,
  width = "100%",
  style,
}: {
  height?: number;
  width?: number | `${number}%`;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.5,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      style={[
        {
          height,
          width,
          borderRadius: 6,
          backgroundColor: t.c.surfaceAlt,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
}

export function LoadingBlock({ rows = 5 }: { rows?: number }) {
  return (
    <Col gap={12} testID="loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={44} />
      ))}
    </Col>
  );
}

export function Banner({
  tone = "info",
  title,
  message,
  action,
  testID,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title: string;
  message?: string;
  action?: React.ReactNode;
  testID?: string;
}) {
  const t = useTheme();
  const [fg, bg] = {
    info: [t.c.info, t.c.infoSoft],
    warning: [t.c.warning, t.c.warningSoft],
    danger: [t.c.danger, t.c.dangerSoft],
    success: [t.c.success, t.c.successSoft],
  }[tone];
  return (
    <Row
      testID={testID}
      gap={12}
      align="flex-start"
      style={{
        backgroundColor: bg,
        borderRadius: t.radius.md,
        padding: 12,
        borderLeftWidth: 3,
        borderLeftColor: fg,
      }}
    >
      {tone === "info" ? (
        <Info size={18} color={fg} />
      ) : (
        <AlertTriangle size={18} color={fg} />
      )}
      <Col gap={2} flex={1}>
        <Text variant="bodyStrong" style={{ color: fg }}>
          {title}
        </Text>
        {message ? (
          <Text variant="caption" tone="muted">
            {message}
          </Text>
        ) : null}
      </Col>
      {action}
    </Row>
  );
}

/* ─────────────────────────── Dialog ─────────────────────────── */

export function Dialog({
  visible,
  onClose,
  title,
  children,
  footer,
  width = 520,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: t.c.overlay,
          justifyContent: "center",
          padding: 16,
        }}
        onPress={onClose}
      >
        <Pressable
          testID={testID}
          onPress={() => undefined}
          style={{
            alignSelf: "center",
            width: "100%",
            maxWidth: width,
            maxHeight: "90%",
            backgroundColor: t.c.surface,
            borderRadius: t.radius.lg,
            borderWidth: 1,
            borderColor: t.c.border,
          }}
        >
          <View style={{ padding: 20, paddingBottom: 8 }}>
            <Text variant="h2">{title}</Text>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 14 }}
          >
            {children}
          </ScrollView>
          {footer ? (
            <Row
              justify="flex-end"
              gap={8}
              style={{
                padding: 16,
                borderTopWidth: 1,
                borderTopColor: t.c.border,
              }}
            >
              {footer}
            </Row>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ─────────────────────────── DataList ─────────────────────────── */

export interface Column<T> {
  key: string;
  title: string;
  /** Relative width on desktop (flex). */
  flex?: number;
  align?: "left" | "right" | "center";
  render: (row: T) => React.ReactNode;
  /** Hide in the phone card view. */
  hideOnPhone?: boolean;
}

/**
 * Responsive list: a real table on tablet/desktop, stacked cards on phones.
 * Handles loading / error / empty and optional pagination.
 */
export function DataList<T>({
  rows,
  columns,
  keyOf,
  onRowPress,
  loading,
  error,
  onRetry,
  empty,
  paging,
  onPage,
  phoneTitle,
  phoneRight,
  testID,
}: {
  rows: T[] | undefined;
  columns: Column<T>[];
  keyOf: (row: T) => string;
  onRowPress?: (row: T) => void;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty?: React.ReactNode;
  paging?: Paging;
  onPage?: (page: number) => void;
  /** Phone card: main line (defaults to the first column). */
  phoneTitle?: (row: T) => React.ReactNode;
  /** Phone card: right-aligned value (e.g. amount). */
  phoneRight?: (row: T) => React.ReactNode;
  testID?: string;
}) {
  const t = useTheme();
  const { isPhone } = useLayout();

  if (error) {
    const msg = (error as { message?: string })?.message || "Please try again.";
    return <ErrorState message={msg} onRetry={onRetry} />;
  }
  if (loading && !rows) return <LoadingBlock />;
  if (!rows || rows.length === 0) {
    return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  }

  const pager =
    paging && onPage && paging.totalPages > 1 ? (
      <Pagination paging={paging} onPage={onPage} />
    ) : null;

  if (isPhone) {
    return (
      <Col gap={10} testID={testID}>
        {rows.map((row) => {
          const visible = columns.filter((c) => !c.hideOnPhone);
          const [first, ...rest] = visible;
          return (
            <Card
              key={keyOf(row)}
              onPress={onRowPress ? () => onRowPress(row) : undefined}
              testID={`row-${keyOf(row)}`}
              padding={14}
            >
              <Row justify="space-between" align="flex-start" gap={12}>
                <View style={{ flex: 1 }}>
                  {phoneTitle ? phoneTitle(row) : first.render(row)}
                </View>
                {phoneRight ? phoneRight(row) : null}
              </Row>
              <Row wrap gap={12} style={{ marginTop: 8 }}>
                {rest.slice(0, 4).map((c) => (
                  <Col key={c.key} gap={1}>
                    <Text variant="caption" tone="faint">
                      {c.title}
                    </Text>
                    {c.render(row)}
                  </Col>
                ))}
              </Row>
            </Card>
          );
        })}
        {pager}
      </Col>
    );
  }

  return (
    <Col gap={12} testID={testID}>
      <View
        style={{
          borderWidth: 1,
          borderColor: t.c.border,
          borderRadius: t.radius.lg,
          overflow: "hidden",
          backgroundColor: t.c.surface,
        }}
      >
        <Row
          gap={0}
          style={{
            backgroundColor: t.c.surfaceAlt,
            paddingHorizontal: 16,
            minHeight: 40,
          }}
        >
          {columns.map((c) => (
            <View key={c.key} style={{ flex: c.flex ?? 1, paddingRight: 12 }}>
              <Text variant="overline" tone="muted" align={c.align}>
                {c.title}
              </Text>
            </View>
          ))}
        </Row>
        {rows.map((row, i) => {
          const rowStyle = {
            flexDirection: "row" as const,
            alignItems: "center" as const,
            paddingHorizontal: 16,
            minHeight: 52,
            paddingVertical: 8,
            borderTopWidth: i === 0 ? 0 : 1,
            borderTopColor: t.c.border,
          };
          const cells = columns.map((c) => (
            <View
              key={c.key}
              style={{
                flex: c.flex ?? 1,
                paddingRight: 12,
                alignItems:
                  c.align === "right"
                    ? "flex-end"
                    : c.align === "center"
                      ? "center"
                      : "flex-start",
              }}
            >
              {c.render(row)}
            </View>
          ));
          // A non-clickable row must be a plain View: a *disabled* Pressable on web
          // also disables every button rendered inside the row.
          if (!onRowPress) {
            return (
              <View
                key={keyOf(row)}
                testID={`row-${keyOf(row)}`}
                style={rowStyle}
              >
                {cells}
              </View>
            );
          }
          return (
            <Pressable
              key={keyOf(row)}
              testID={`row-${keyOf(row)}`}
              onPress={() => onRowPress(row)}
              style={({ hovered }) => [
                rowStyle,
                { backgroundColor: hovered ? t.c.surfaceAlt : "transparent" },
              ]}
            >
              {cells}
            </Pressable>
          );
        })}
      </View>
      {loading ? <ActivityIndicator color={t.c.accent} /> : null}
      {pager}
    </Col>
  );
}

export function Pagination({
  paging,
  onPage,
}: {
  paging: Paging;
  onPage: (p: number) => void;
}) {
  return (
    <Row justify="space-between" testID="pagination">
      <Text variant="caption" tone="muted">
        Page {paging.page} of {paging.totalPages} · {paging.total} total
      </Text>
      <Row gap={4}>
        <IconButton
          icon={ChevronLeft}
          label="Previous page"
          testID="page-prev"
          onPress={() => paging.page > 1 && onPage(paging.page - 1)}
        />
        <IconButton
          icon={ChevronRight}
          label="Next page"
          testID="page-next"
          onPress={() =>
            paging.page < paging.totalPages && onPage(paging.page + 1)
          }
        />
      </Row>
    </Row>
  );
}
