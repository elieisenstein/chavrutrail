import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "system" | "light" | "dark";
export type Language = "he" | "en";
export type TabName = "FeedStack" | "MyRidesStack" | "CreateStack" | "NavigationStack" | "ProfileStack";

const KEYS = {
  themeMode: "prefs.themeMode",
  language: "prefs.language",
  lastTab: "prefs.lastTab",
};

export async function getThemeMode(): Promise<ThemeMode> {
  const v = await AsyncStorage.getItem(KEYS.themeMode);
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

export async function setThemeMode(mode: ThemeMode): Promise<void> {
  await AsyncStorage.setItem(KEYS.themeMode, mode);
}

export async function getLanguage(): Promise<Language> {
  const v = await AsyncStorage.getItem(KEYS.language);
  if (v === "he" || v === "en") return v;
  return "he";
}

export async function setLanguage(lang: Language): Promise<void> {
  await AsyncStorage.setItem(KEYS.language, lang);
}

const VALID_TABS: TabName[] = ["FeedStack", "MyRidesStack", "CreateStack", "NavigationStack", "ProfileStack"];

export async function getLastTab(): Promise<TabName> {
  const v = await AsyncStorage.getItem(KEYS.lastTab);
  if (v && VALID_TABS.includes(v as TabName)) return v as TabName;
  return "FeedStack";
}

export async function setLastTab(tab: TabName): Promise<void> {
  await AsyncStorage.setItem(KEYS.lastTab, tab);
}
