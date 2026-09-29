import React from "react";
import { View } from "react-native";
import { Row } from "@shared/ui";
import { useLayout } from "@shared/useTheme";

/** Side-by-side fields on tablet/desktop, stacked on phones. */
export function FormGrid({ children, columns }: { children: React.ReactNode; columns?: number }) {
  const { isPhone } = useLayout();
  const items = React.Children.toArray(children).filter(Boolean);
  if (isPhone) {
    return <View style={{ gap: 14 }}>{items}</View>;
  }
  const cols = columns ?? items.length;
  return (
    <Row gap={12} align="flex-start" wrap>
      {items.map((child, i) => (
        <View key={i} style={{ flexBasis: `${Math.floor(100 / cols) - 2}%`, flexGrow: 1, minWidth: 160 }}>
          {child}
        </View>
      ))}
    </Row>
  );
}
