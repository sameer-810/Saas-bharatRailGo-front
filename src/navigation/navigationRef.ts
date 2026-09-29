import { createNavigationContainerRef } from "@react-navigation/native";

/** Lets non-component code (command palette, notifications) navigate. */
export const navigationRef = createNavigationContainerRef();
