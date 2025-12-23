import { MD3DarkTheme, MD3LightTheme } from "react-native-paper";
import { colors } from "./tokens";

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.brand.primary,
    background: colors.light.background,
    surface: colors.light.surface,
    onSurface: colors.light.text,
    onBackground: colors.light.text,
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.brand.primary,
    background: colors.dark.background,
    surface: colors.dark.surface,
    onSurface: colors.dark.text,
    onBackground: colors.dark.text,
  },
};
