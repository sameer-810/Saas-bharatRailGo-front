/**
 * Branding — logo (PUT/DELETE /business-profile/logo), brand colour (PATCH
 * brandColor → app re-themes instantly) and the personal theme preference.
 */
import React, { useState } from "react";
import { Image, Pressable, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Check, ImageOff, Upload } from "lucide-react-native";
import { useTheme } from "@shared/useTheme";
import {
  Banner,
  Button,
  Card,
  Col,
  ErrorState,
  LoadingBlock,
  Row,
  Screen,
  SegmentedControl,
  Text,
  TextField,
  confirm,
  toast,
} from "@shared/ui";
import { readableOn } from "@shared/theme";
import { useApiMutation } from "@shared/api/query";
import { apiErrorMessage } from "@shared/api/apiClient";
import { useBusinessProfile, type BusinessProfile } from "@shared/api/lookups";
import { useCan, useReadOnly } from "@shared/lib/permissions";
import {
  useThemeStore,
  type ThemePreference,
} from "@shared/store/useThemeStore";
import { BiltiHeaderPreview } from "../components/BiltiHeaderPreview";
import { CardTitle, Grid, ReadOnlyBanner } from "../components/common";

const MAX_LOGO_BYTES = 300 * 1024;
const HEX = /^#[0-9a-f]{6}$/i;

/** Curated brand swatches — all readable with white or ink text. */
const PALETTE = [
  "#1A237E", // indigo (default)
  "#3346D3", // signal blue
  "#0D47A1", // navy
  "#00695C", // teal
  "#2E7D32", // green
  "#827717", // olive
  "#E65100", // saffron
  "#BF360C", // brick
  "#B71C1C", // railway red
  "#880E4F", // maroon
  "#4A148C", // purple
  "#263238", // charcoal
];

/** Detect PNG / JPEG from the base64 magic bytes (the picker's mimeType is not reliable). */
function detectMime(base64: string): "image/png" | "image/jpeg" | null {
  if (base64.startsWith("iVBORw0KGgo")) return "image/png";
  if (base64.startsWith("/9j/")) return "image/jpeg";
  return null;
}

function base64Bytes(b64: string) {
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

export function SettingsBrandingScreen() {
  const canEdit = useCan("settings.manage");
  const profile = useBusinessProfile();
  return (
    <Screen
      title="Branding"
      subtitle="Make the app, bilti and invoices look like your agency."
      back
      backTo="Settings"
      testID="settings-branding-screen"
    >
      <Col gap={16}>
        {canEdit ? (
          profile.isLoading ? (
            <LoadingBlock rows={4} />
          ) : profile.error || !profile.data ? (
            <ErrorState
              message={apiErrorMessage(
                profile.error,
                "Could not load the profile",
              )}
              onRetry={() => profile.refetch()}
            />
          ) : (
            <BrandEditor profile={profile.data} />
          )
        ) : (
          <Banner
            tone="info"
            title="Only the owner can change the logo and brand colour"
          />
        )}
        <ThemeCard />
      </Col>
    </Screen>
  );
}

function BrandEditor({ profile }: { profile: BusinessProfile }) {
  const t = useTheme();
  const readOnly = useReadOnly();
  const setBrandColor = useThemeStore((s) => s.setBrandColor);
  const saved =
    profile.brandColor && HEX.test(profile.brandColor)
      ? profile.brandColor
      : t.c.accent;
  const [color, setColor] = useState(saved);
  const [hex, setHex] = useState(saved);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const [syncedFrom, setSyncedFrom] = useState(saved);
  if (syncedFrom !== saved) {
    // Saved colour changed on the server (after save / refetch) — follow it.
    setSyncedFrom(saved);
    setColor(saved);
    setHex(saved);
  }

  const uploadLogo = useApiMutation<BusinessProfile, { dataUrl: string }>(
    "put",
    "/business-profile/logo",
    {
      invalidate: ["business-profile"],
    },
  );
  const removeLogo = useApiMutation<BusinessProfile, void>(
    "delete",
    "/business-profile/logo",
    {
      invalidate: ["business-profile"],
    },
  );
  const saveColor = useApiMutation<BusinessProfile, { brandColor: string }>(
    "patch",
    "/business-profile",
    {
      invalidate: ["business-profile"],
    },
  );

  const pick = async () => {
    setLogoError(null);
    setPicking(true);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        base64: true,
        quality: 0.8,
        allowsMultipleSelection: false,
      });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      let b64 = asset.base64 || "";
      // Web may hand back a full data URL in uri instead of base64.
      if (!b64 && asset.uri?.startsWith("data:"))
        b64 = asset.uri.split(",")[1] || "";
      if (!b64) {
        setLogoError("Could not read that image. Try another file.");
        return;
      }
      const mime =
        detectMime(b64) ||
        (asset.mimeType === "image/png" || asset.mimeType === "image/jpeg"
          ? asset.mimeType
          : null);
      if (!mime) {
        setLogoError("The logo must be a PNG or JPEG image.");
        return;
      }
      const bytes = base64Bytes(b64);
      if (bytes > MAX_LOGO_BYTES) {
        setLogoError(
          `This image is ${Math.round(bytes / 1024)} KB — the logo must be 300 KB or smaller. Crop it or save it smaller and try again.`,
        );
        return;
      }
      await uploadLogo.mutateAsync({ dataUrl: `data:${mime};base64,${b64}` });
      toast.success("Logo updated");
    } catch (err) {
      const msg = apiErrorMessage(err, "Could not upload the logo");
      setLogoError(msg);
      toast.error(msg);
    } finally {
      setPicking(false);
    }
  };

  const onRemove = async () => {
    const ok = await confirm({
      title: "Remove logo?",
      message: "Bilti and invoices will show your business initial instead.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      await removeLogo.mutateAsync(undefined);
      toast.success("Logo removed");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const choose = (c: string) => {
    setColor(c.toUpperCase());
    setHex(c.toUpperCase());
  };

  const onSaveColor = async () => {
    if (!HEX.test(color)) return;
    try {
      await saveColor.mutateAsync({ brandColor: color });
      setBrandColor(color);
      toast.success("Brand colour saved");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const colorDirty = color.toLowerCase() !== saved.toLowerCase();
  const hexError =
    hex && !HEX.test(hex) ? "Use a hex value like #1A237E" : undefined;

  return (
    <Col gap={16}>
      <ReadOnlyBanner />
      <Card>
        <CardTitle
          title="Preview"
          caption="How the bilti header will look with these choices."
        />
        <BiltiHeaderPreview
          color={color}
          logoDataUrl={profile.logoDataUrl}
          businessName={profile.businessName}
          tagline={profile.tagline}
          biltiPrefix={profile.podNumberPrefix}
          biltiNumber={profile.nextPodNumber}
        />
      </Card>

      <Grid basis={360}>
        <Card testID="branding-logo-card">
          <CardTitle
            title="Logo"
            caption="PNG or JPEG, up to 300 KB. A square logo on a plain background prints best."
          />
          <Row gap={16} align="center" wrap>
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: t.radius.md,
                borderWidth: 1,
                borderColor: t.c.border,
                backgroundColor: t.c.surfaceSunken,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {profile.logoDataUrl ? (
                <Image
                  testID="branding-logo-current"
                  source={{ uri: profile.logoDataUrl }}
                  style={{ width: 88, height: 88 }}
                  resizeMode="contain"
                  accessibilityLabel="Current logo"
                />
              ) : (
                <Col align="center" gap={4}>
                  <ImageOff size={22} color={t.c.textFaint} />
                  <Text variant="caption" tone="faint">
                    No logo
                  </Text>
                </Col>
              )}
            </View>
            <Col gap={8}>
              <Button
                testID="branding-logo-upload"
                title={profile.logoDataUrl ? "Replace logo" : "Upload logo"}
                icon={Upload}
                loading={picking || uploadLogo.isPending}
                disabled={readOnly}
                onPress={pick}
              />
              {profile.logoDataUrl ? (
                <Button
                  testID="branding-logo-remove"
                  title="Remove logo"
                  variant="ghost"
                  loading={removeLogo.isPending}
                  disabled={readOnly}
                  onPress={onRemove}
                />
              ) : null}
            </Col>
          </Row>
          {logoError ? (
            <View style={{ marginTop: 12 }}>
              <Banner
                testID="branding-logo-error"
                tone="danger"
                title="Logo not uploaded"
                message={logoError}
              />
            </View>
          ) : null}
        </Card>

        <Card testID="branding-color-card">
          <CardTitle
            title="Brand colour"
            caption="Used for buttons and highlights across the app, and on bilti and invoices."
          />
          <Row wrap gap={10}>
            {PALETTE.map((c) => {
              const active = c.toLowerCase() === color.toLowerCase();
              return (
                <Pressable
                  key={c}
                  testID={`branding-swatch-${c.slice(1).toLowerCase()}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Colour ${c}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => choose(c)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: c,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: active ? 3 : 1,
                    borderColor: active ? t.c.text : t.c.border,
                  }}
                >
                  {active ? <Check size={18} color={readableOn(c)} /> : null}
                </Pressable>
              );
            })}
          </Row>
          <Row gap={10} align="flex-start" style={{ marginTop: 14 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: t.radius.md,
                borderWidth: 1,
                borderColor: t.c.border,
                backgroundColor: HEX.test(color) ? color : t.c.surfaceAlt,
              }}
            />
            <View style={{ flex: 1 }}>
              <TextField
                testID="branding-hex"
                value={hex}
                mono
                autoCapitalize="characters"
                maxLength={7}
                placeholder="#1A237E"
                onChangeText={(s) => {
                  const v = s.startsWith("#") ? s : `#${s}`;
                  setHex(v);
                  if (HEX.test(v)) setColor(v.toUpperCase());
                }}
                error={hexError}
              />
            </View>
          </Row>
          <Row justify="flex-end" gap={8} style={{ marginTop: 14 }}>
            <Button
              testID="branding-color-reset"
              title="Reset"
              variant="secondary"
              disabled={!colorDirty}
              onPress={() => choose(saved)}
            />
            <Button
              testID="branding-color-save"
              title="Save colour"
              loading={saveColor.isPending}
              disabled={readOnly || !colorDirty || !HEX.test(color)}
              onPress={onSaveColor}
            />
          </Row>
        </Card>
      </Grid>
    </Col>
  );
}

function ThemeCard() {
  const { preference, setPreference } = useThemeStore();
  return (
    <Card testID="branding-theme-card">
      <CardTitle
        title="Appearance"
        caption="Your own preference on this device. Dark suits the godown at night."
      />
      <SegmentedControl<ThemePreference>
        testID="branding-theme"
        value={preference}
        onChange={setPreference}
        options={[
          { value: "system", label: "System" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
      />
    </Card>
  );
}
