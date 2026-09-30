import React, { useState } from "react";
import { Pressable } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LogIn } from "lucide-react-native";
import { Banner, Button, Col, Row, Text, TextField } from "@shared/ui";
import {
  apiClient,
  apiErrorCode,
  apiErrorMessage,
} from "@shared/api/apiClient";
import { useAuthStore } from "@shared/store/useAuthStore";
import { useBranchStore } from "@shared/store/useBranchStore";
import { AuthLayout } from "./AuthLayout";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});
type Form = z.infer<typeof schema>;

export function LoginScreen({
  navigation,
}: {
  navigation: { navigate: (r: string, p?: object) => void };
}) {
  const setSession = useAuthStore((s) => s.setSession);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const res = await apiClient.post("/auth/login", values);
      useBranchStore.getState().setBranchId("all");
      setSession(res.data.data);
    } catch (err) {
      const code = apiErrorCode(err);
      if (code === "ORG_PENDING_APPROVAL")
        return navigation.navigate("Pending", {});
      setError(apiErrorMessage(err, "Could not sign in"));
    }
  });

  return (
    <AuthLayout>
      <Col gap={20}>
        <Col gap={6}>
          <Text variant="display">Sign in</Text>
          <Text tone="muted">Welcome back to your parcel office.</Text>
        </Col>
        {error ? (
          <Banner tone="danger" title={error} testID="login-error" />
        ) : null}
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <TextField
              testID="login-email"
              label="Email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={field.value}
              onChangeText={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <TextField
              testID="login-password"
              label="Password"
              secureTextEntry
              autoComplete="password"
              value={field.value}
              onChangeText={field.onChange}
              onSubmitEditing={onSubmit}
              error={fieldState.error?.message}
            />
          )}
        />
        <Button
          testID="login-submit"
          title="Sign in"
          icon={LogIn}
          size="lg"
          loading={formState.isSubmitting}
          onPress={onSubmit}
          fullWidth
        />
        <Row justify="space-between" wrap>
          <Pressable
            onPress={() => navigation.navigate("Signup")}
            testID="go-signup"
          >
            <Text variant="label" tone="accent">
              New agency? Start a free trial
            </Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("Admin")}
            testID="go-admin"
          >
            <Text variant="caption" tone="faint">
              Platform admin
            </Text>
          </Pressable>
        </Row>
      </Col>
    </AuthLayout>
  );
}
