import type { ReactNode } from 'react';
import {
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

export function MarkedView({
  id,
  children,
  ...rest
}: Marked & ViewProps & { children?: ReactNode }) {
  return (
    <View testID={id} accessibilityLabel={id} {...rest}>
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
    <Text testID={id} accessibilityLabel={id} {...rest}>
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
      accessibilityLabel={id}
      accessibilityRole="button"
      {...rest}
    >
      {children}
    </Pressable>
  );
}

export function MarkedTextInput({ id, ...rest }: Marked & TextInputProps) {
  return <TextInput testID={id} accessibilityLabel={id} {...rest} />;
}
