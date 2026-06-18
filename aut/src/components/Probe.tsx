import type { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  type PressableProps,
  Text,
  TextInput,
  type TextInputProps,
  type TextProps,
  View,
  type ViewProps,
} from 'react-native';

interface Marked {
  id: string;
}

// Appium resolves `accessibility id` from a different native attribute per
// platform: UiAutomator2 matches Android's content-description (populated from
// accessibilityLabel), while XCUITest matches the iOS accessibilityIdentifier
// (populated from testID). We therefore set accessibilityLabel only on
// Android. On iOS it is both unnecessary (testID already drives the lookup)
// and harmful: it overrides the element's label/value, so `aco element text`
// would return the id instead of the rendered text.
function a11yLabel(id: string): { accessibilityLabel?: string } {
  return Platform.OS === 'android' ? { accessibilityLabel: id } : {};
}

export function MarkedView({
  id,
  children,
  ...rest
}: Marked & ViewProps & { children?: ReactNode }) {
  return (
    <View testID={id} {...a11yLabel(id)} {...rest}>
      {children}
    </View>
  );
}

export function MarkedText({
  id,
  children,
  ...rest
}: Marked & TextProps & { children?: ReactNode }) {
  return (
    <Text testID={id} {...a11yLabel(id)} {...rest}>
      {children}
    </Text>
  );
}

export function MarkedPressable({
  id,
  children,
  ...rest
}: Marked & PressableProps & { children?: ReactNode }) {
  return (
    <Pressable
      testID={id}
      {...a11yLabel(id)}
      accessibilityRole="button"
      {...rest}
    >
      {children}
    </Pressable>
  );
}

export function MarkedTextInput({ id, ...rest }: Marked & TextInputProps) {
  return <TextInput testID={id} {...a11yLabel(id)} {...rest} />;
}
