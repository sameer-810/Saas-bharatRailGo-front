/** Small grouped table with a totals row (daily summary). Scrolls sideways on phones. */
import React from "react";
import { ScrollView, View } from "react-native";
import { Row, Text } from "@shared/ui";
import { useLayout, useTheme } from "@shared/useTheme";

export interface SummaryCol {
  key: string;
  title: string;
  flex?: number;
  align?: "left" | "right";
  mono?: boolean;
}

export function SummaryTable({
  cols,
  rows,
  totals,
  testID,
}: {
  cols: SummaryCol[];
  rows: { key: string; cells: Record<string, React.ReactNode> }[];
  totals?: Record<string, React.ReactNode>;
  testID?: string;
}) {
  const t = useTheme();
  const { isPhone } = useLayout();
  const cell = (c: SummaryCol, v: React.ReactNode, strong?: boolean) => (
    <View key={c.key} style={{ flex: c.flex ?? 1, minWidth: isPhone ? 90 : undefined, paddingRight: 10, alignItems: c.align === "right" ? "flex-end" : "flex-start" }}>
      {typeof v === "string" || typeof v === "number" ? (
        <Text
          variant={strong ? "bodyStrong" : "body"}
          style={c.mono ? { fontFamily: t.fonts.mono, fontVariant: ["tabular-nums"] } : undefined}
        >
          {String(v)}
        </Text>
      ) : (
        v
      )}
    </View>
  );
  const table = (
    <View
      testID={testID}
      style={{
        borderWidth: 1,
        borderColor: t.c.border,
        borderRadius: t.radius.lg,
        overflow: "hidden",
        backgroundColor: t.c.surface,
        minWidth: isPhone ? cols.length * 100 : undefined,
      }}
    >
      <Row gap={0} style={{ backgroundColor: t.c.surfaceAlt, paddingHorizontal: 14, minHeight: 38 }}>
        {cols.map((c) => (
          <View key={c.key} style={{ flex: c.flex ?? 1, minWidth: isPhone ? 90 : undefined, paddingRight: 10, alignItems: c.align === "right" ? "flex-end" : "flex-start" }}>
            <Text variant="overline" tone="muted">
              {c.title}
            </Text>
          </View>
        ))}
      </Row>
      {rows.map((r) => (
        <Row key={r.key} gap={0} testID={testID ? `${testID}-row-${r.key}` : undefined} style={{ paddingHorizontal: 14, minHeight: 44, borderTopWidth: 1, borderTopColor: t.c.border }}>
          {cols.map((c) => cell(c, r.cells[c.key] ?? "—"))}
        </Row>
      ))}
      {totals ? (
        <Row gap={0} testID={testID ? `${testID}-totals` : undefined} style={{ paddingHorizontal: 14, minHeight: 46, borderTopWidth: 2, borderTopColor: t.c.borderStrong, backgroundColor: t.c.surfaceAlt }}>
          {cols.map((c) => cell(c, totals[c.key] ?? "", true))}
        </Row>
      ) : null}
    </View>
  );
  return isPhone ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {table}
    </ScrollView>
  ) : (
    table
  );
}
