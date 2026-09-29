import React from "react";
import { Clock } from "lucide-react-native";
import { useRoute } from "@react-navigation/native";
import { useTheme } from "@shared/useTheme";
import { Button, Card, Col, FlapText, Text } from "@shared/ui";
import { AuthLayout } from "./AuthLayout";

/** Shown after signup (or a blocked login) while the platform reviews the agency. */
export function PendingScreen({ navigation }: { navigation: { navigate: (r: string) => void } }) {
  const t = useTheme();
  const params = (useRoute().params || {}) as { businessName?: string };
  return (
    <AuthLayout>
      <Card testID="pending-card" padding={28}>
        <Col gap={16} align="flex-start">
          <Clock size={28} color={t.c.accent} />
          <FlapText text="IN REVIEW" size={20} />
          <Text variant="h1">Your account is being reviewed</Text>
          <Text tone="muted">
            {params.businessName ? `${params.businessName} is registered. ` : ""}
            We verify every agency before activating it — usually within one working day. Your
            14-day free trial starts the moment it is approved.
          </Text>
          <Button title="Back to sign in" variant="secondary" onPress={() => navigation.navigate("Login")} testID="pending-back" />
        </Col>
      </Card>
    </AuthLayout>
  );
}
