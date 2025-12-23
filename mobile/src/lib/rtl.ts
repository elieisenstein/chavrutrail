import { I18nManager } from "react-native";

export function configureRtl(locale: string) {
  const shouldBeRtl = locale?.toLowerCase().startsWith("he");
  I18nManager.allowRTL(shouldBeRtl);
  I18nManager.forceRTL(shouldBeRtl);
}
