/** Self-serve signup: agency details + owner account → pending approval (or straight in). */
import React, { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { Check } from "lucide-react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLayout, useTheme } from "@shared/useTheme";
import { SITE_URL } from "@config/env";
import { Banner, Button, Col, Row, Text, TextField } from "@shared/ui";
import { apiClient, apiErrorMessage } from "@shared/api/apiClient";
import { useAuthStore } from "@shared/store/useAuthStore";
import { AuthLayout } from "./AuthLayout";

const schema = z.object({
  businessName: z.string().trim().min(2, "Enter your agency name"),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a valid 15-character GSTIN"),
  officeAddress: z.string().trim().min(5, "Enter your office address"),
  city: z.string().trim().optional(),
  mobile: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "10-digit mobile number")
    .optional()
    .or(z.literal("")),
  name: z.string().trim().min(1, "Enter your name"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
  // DPDP Act 2023: notice + consent before any personal data is collected.
  acceptTerms: z.boolean().refine((v) => v, "Please accept the Terms and Privacy Policy"),
});
type Form = z.infer<typeof schema>;

export function SignupScreen({ navigation }: { navigation: { navigate: (r: string, p?: object) => void } }) {
  const { isPhone } = useLayout();
  const t = useTheme();
  const setSession = useAuthStore((s) => s.setSession);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      businessName: "",
      gstin: "",
      officeAddress: "",
      city: "",
      mobile: "",
      name: "",
      email: "",
      password: "",
      acceptTerms: false,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const body = { ...values, mobile: values.mobile || undefined, city: values.city || undefined };
      const res = await apiClient.post("/auth/signup", body);
      const data = res.data.data;
      if (data.requiresApproval) navigation.navigate("Pending", { businessName: values.businessName });
      else setSession(data);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create the account"));
    }
  });

  const field = (
    name: keyof Form,
    label: string,
    props: Partial<React.ComponentProps<typeof TextField>> = {},
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field: f, fieldState }) => (
        <TextField
          testID={`signup-${name}`}
          label={label}
          value={f.value as string}
          onChangeText={f.onChange}
          error={fieldState.error?.message}
          {...props}
        />
      )}
    />
  );

  return (
    <AuthLayout>
      <Col gap={16}>
        <Col gap={6}>
          <Text variant="display">Start your free trial</Text>
          <Text tone="muted">14 days, every feature. No card needed.</Text>
        </Col>
        {error ? <Banner tone="danger" title={error} testID="signup-error" /> : null}
        <Text variant="overline" tone="muted">
          Your agency
        </Text>
        {field("businessName", "Agency name", { placeholder: "e.g. Shree Ram Parcel Services" })}
        <Row gap={12} align="flex-start" style={{ flexDirection: isPhone ? "column" : "row" }}>
          <Col flex={1} style={{ alignSelf: "stretch" }}>
            {field("gstin", "GSTIN", { autoCapitalize: "characters", mono: true, maxLength: 15 })}
          </Col>
          <Col flex={1} style={{ alignSelf: "stretch" }}>
            {field("city", "City")}
          </Col>
        </Row>
        {field("officeAddress", "Office address", { multiline: true })}
        <Text variant="overline" tone="muted">
          Owner account
        </Text>
        {field("name", "Your name")}
        {field("mobile", "Mobile", { keyboardType: "phone-pad", maxLength: 10 })}
        {field("email", "Email", { autoCapitalize: "none", keyboardType: "email-address" })}
        {field("password", "Password", { secureTextEntry: true, hint: "At least 8 characters" })}
        <Controller
          control={control}
          name="acceptTerms"
          render={({ field: f, fieldState }) => (
            <Col gap={4}>
              <Row gap={10} align="flex-start">
                <Pressable
                  testID="signup-acceptTerms"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: !!f.value }}
                  accessibilityLabel="I accept the Terms of Service and Privacy Policy"
                  onPress={() => f.onChange(!f.value)}
                  hitSlop={8}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      marginTop: 1,
                      borderRadius: 6,
                      borderWidth: 1.5,
                      borderColor: f.value ? t.c.accent : fieldState.error ? t.c.danger : t.c.borderStrong,
                      backgroundColor: f.value ? t.c.accent : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {f.value ? <Check size={15} color={t.c.accentText} /> : null}
                  </View>
                </Pressable>
                <Text variant="caption" tone="muted" style={{ flex: 1 }}>
                  I accept the{" "}
                  <Text variant="caption" tone="accent" onPress={() => Linking.openURL(`${SITE_URL}/#/terms`)}>
                    Terms of Service
                  </Text>{" "}
                  and{" "}
                  <Text variant="caption" tone="accent" onPress={() => Linking.openURL(`${SITE_URL}/#/privacy`)}>
                    Privacy Policy
                  </Text>
                  , and agree that my agency&apos;s data is processed to provide the service.
                </Text>
              </Row>
              {fieldState.error ? (
                <Text variant="caption" tone="danger" testID="signup-acceptTerms-error">
                  {fieldState.error.message}
                </Text>
              ) : null}
            </Col>
          )}
        />
        <Button
          testID="signup-submit"
          title="Create my account"
          size="lg"
          fullWidth
          loading={formState.isSubmitting}
          onPress={onSubmit}
        />
        <Pressable onPress={() => navigation.navigate("Login")} testID="go-login">
          <Text variant="label" tone="accent">
            Already have an account? Sign in
          </Text>
        </Pressable>
      </Col>
    </AuthLayout>
  );
}
