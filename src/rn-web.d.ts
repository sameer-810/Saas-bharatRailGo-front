/**
 * react-native-web adds hover/focus to Pressable's state callback; the core
 * RN types don't declare them.
 */
import "react-native";

declare module "react-native" {
  interface PressableStateCallbackType {
    hovered?: boolean;
    focused?: boolean;
  }
}
