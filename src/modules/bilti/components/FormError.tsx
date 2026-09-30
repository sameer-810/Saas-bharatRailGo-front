/** Save-error banner; plan / subscription errors get a link to the Plan screen. */
import React from "react";
import { Banner, Button } from "@shared/ui";
import { useAppNav } from "@navigation/useAppNav";

export interface FormErrorState {
  code?: string;
  message: string;
}

export function FormError({
  error,
  testID,
}: {
  error: FormErrorState | null;
  testID?: string;
}) {
  const nav = useAppNav();
  if (!error) return null;
  const planIssue =
    error.code === "PLAN_LIMIT_REACHED" ||
    error.code === "SUBSCRIPTION_EXPIRED";
  return (
    <Banner
      testID={testID}
      tone={planIssue ? "warning" : "danger"}
      title={
        error.code === "PLAN_LIMIT_REACHED"
          ? "Monthly limit reached"
          : error.code === "SUBSCRIPTION_EXPIRED"
            ? "Subscription expired"
            : "Could not save"
      }
      message={error.message}
      action={
        planIssue ? (
          <Button
            testID={testID ? `${testID}-plan` : undefined}
            title="Plan"
            size="sm"
            variant="secondary"
            onPress={() => nav.navigate("Plan")}
          />
        ) : undefined
      }
    />
  );
}
