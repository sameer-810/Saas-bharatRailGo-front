/**
 * Live preview of the bilti header in a chosen brand colour. The colour is the
 * candidate the owner is picking, so it is applied directly (not via the theme
 * accent, which only changes after saving).
 */
import React from "react";
import { Image, View } from "react-native";
import { useTheme } from "@shared/useTheme";
import { mix, readableOn } from "@shared/theme";
import { Col, Row, Text } from "@shared/ui";

export function BiltiHeaderPreview({
  color,
  logoDataUrl,
  businessName,
  tagline,
  biltiPrefix,
  biltiNumber,
}: {
  color: string;
  logoDataUrl?: string | null;
  businessName: string;
  tagline?: string;
  biltiPrefix?: string;
  biltiNumber?: number;
}) {
  const t = useTheme();
  const valid = /^#[0-9a-f]{6}$/i.test(color);
  const brand = valid ? color : t.c.accent;
  const onBrand = readableOn(brand);
  const soft = mix(
    brand,
    t.isDark ? "#000000" : "#FFFFFF",
    t.isDark ? 0.7 : 0.9,
  );
  const initial = (businessName || "?").trim().charAt(0).toUpperCase();

  return (
    <View
      testID="branding-preview"
      style={{
        borderRadius: t.radius.lg,
        borderWidth: 1,
        borderColor: t.c.border,
        overflow: "hidden",
        backgroundColor: t.c.surface,
      }}
    >
      <Row gap={14} style={{ backgroundColor: brand, padding: 16 }}>
        {logoDataUrl ? (
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: t.radius.md,
              padding: 4,
            }}
          >
            <Image
              testID="branding-preview-logo"
              source={{ uri: logoDataUrl }}
              style={{ width: 52, height: 52 }}
              resizeMode="contain"
              accessibilityLabel="Logo"
            />
          </View>
        ) : (
          <View
            testID="branding-preview-monogram"
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              borderWidth: 2,
              borderColor: onBrand,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text variant="h1" style={{ color: onBrand }}>
              {initial}
            </Text>
          </View>
        )}
        <Col gap={2} flex={1}>
          <Text variant="h2" style={{ color: onBrand }} numberOfLines={1}>
            {businessName || "Your business name"}
          </Text>
          {tagline ? (
            <Text
              variant="caption"
              style={{ color: onBrand, opacity: 0.85 }}
              numberOfLines={1}
            >
              {tagline}
            </Text>
          ) : null}
        </Col>
      </Row>
      <Row
        justify="space-between"
        wrap
        gap={8}
        style={{
          backgroundColor: soft,
          paddingHorizontal: 16,
          paddingVertical: 10,
        }}
      >
        <Text variant="overline" style={{ color: brand }}>
          Bilti / Parcel receipt
        </Text>
        <Row gap={6}>
          <Text variant="caption" tone="muted">
            No.
          </Text>
          <Text
            variant="mono"
            style={{ color: brand, fontFamily: t.fonts.monoBold }}
            testID="branding-preview-number"
          >
            {`${biltiPrefix || ""}${biltiNumber ?? 1001}`}
          </Text>
        </Row>
      </Row>
      <Row gap={16} wrap style={{ padding: 16 }}>
        {[
          ["From", "BCT"],
          ["To", "NDLS"],
          ["Pkgs", "4"],
          ["Weight", "62 kg"],
        ].map(([k, v]) => (
          <Col key={k} gap={2}>
            <Text variant="caption" tone="faint">
              {k}
            </Text>
            <Text variant="mono">{v}</Text>
          </Col>
        ))}
      </Row>
    </View>
  );
}
