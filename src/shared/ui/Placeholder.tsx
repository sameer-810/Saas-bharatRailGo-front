import React from "react";
import { useRoute } from "@react-navigation/native";
import { Screen, EmptyState } from "./layout";

/** Stand-in for screens not built yet. */
export function Placeholder() {
  const route = useRoute();
  return (
    <Screen title={route.name} testID="placeholder">
      <EmptyState
        title="Coming soon"
        message={`The ${route.name} screen is being built.`}
      />
    </Screen>
  );
}
