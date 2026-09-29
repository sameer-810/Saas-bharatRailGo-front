/** Compact money tiles: what came in today and what is still owed. */
import React from "react";
import { Pressable, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { Money, Row, Col, Skeleton, Text } from "@shared/ui";
import { useLayout, useTheme } from "@shared/useTheme";

export interface MoneyTileSpec {
  key: string;
  label: string;
  /** Money value; use `count` instead for plain numbers. */
  amount?: number;
  count?: number;
  hint?: string;
  tone?: "default" | "warning";
  onPress?: () => void;
}

function MoneyTile({ spec, loading }: { spec: MoneyTileSpec; loading: boolean }) {
  const t = useTheme();
  const { isPhone } = useLayout();
  const rule = spec.tone === "warning" ? t.c.warning : t.c.accent;
  const content = (
    <Row gap={12} align="stretch">
      <View style={{ width: 3, borderRadius: 2, backgroundColor: rule }} />
      <Col gap={4} flex={1}>
        <Row justify="space-between">
          <Text variant="overline" tone="muted" numberOfLines={1}>
            {spec.label}
          </Text>
          {spec.onPress ? <ChevronRight size={14} color={t.c.textFaint} /> : null}
        </Row>
        {loading ? (
          <Skeleton height={26} width="70%" />
        ) : spec.amount !== undefined ? (
          <Money value={spec.amount} variant="h2" compact={isPhone} />
        ) : (
          <Text variant="h2" style={{ fontFamily: t.fonts.mono, fontVariant: ["tabular-nums"] }}>
            {spec.count ?? 0}
          </Text>
        )}
        {spec.hint ? (
          <Text variant="caption" tone="faint" numberOfLines={1}>
            {loading ? " " : spec.hint}
          </Text>
        ) : null}
      </Col>
    </Row>
  );
  const box = {
    flexGrow: 1,
    flexBasis: isPhone ? 150 : 180,
    backgroundColor: t.c.surface,
    borderWidth: 1,
    borderColor: t.c.border,
    borderRadius: t.radius.lg,
    padding: 14,
  } as const;
  if (spec.onPress) {
    return (
      <Pressable
        testID={`money-${spec.key}`}
        accessibilityRole="button"
        onPress={spec.onPress}
        style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
          box,
          (hovered || pressed) && { borderColor: t.c.borderStrong },
        ]}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View testID={`money-${spec.key}`} style={box}>
      {content}
    </View>
  );
}

export function MoneyStrip({ tiles, loading }: { tiles: MoneyTileSpec[]; loading: boolean }) {
  return (
    <Row wrap gap={12} align="stretch" testID="money-strip">
      {tiles.map((s) => (
        <MoneyTile key={s.key} spec={s} loading={loading} />
      ))}
    </Row>
  );
}
