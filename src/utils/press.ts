import { Platform } from "react-native";

export function makePress<T extends (...args:any[]) => any>(fn?: T) {
  return (e?: any) => {
    if (Platform.OS === "web") {
      e?.preventDefault?.();
      e?.stopPropagation?.();
    }
    fn?.();
  };
}















