/** Shared UI primitives — glassmorphism per the UI brief. */
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, radius, spacing } from '../theme';
import { fontFamily } from '../fonts';

export function GlassCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
  danger,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        danger && styles.buttonDanger,
        disabled && styles.buttonDisabled,
        pressed && styles.buttonPressed,
        style,
      ]}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}

export function Field({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize,
  autoCorrect,
  onSubmitEditing,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  onSubmitEditing?: () => void;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.text3}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize ?? 'sentences'}
      autoCorrect={autoCorrect}
      onSubmitEditing={onSubmitEditing}
      style={styles.field}
    />
  );
}

export function Title({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Subtitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.subtitle, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  button: {
    backgroundColor: colors.amber,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.amber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonDanger: {
    backgroundColor: colors.red,
    shadowColor: colors.red,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  buttonText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 16,
    color: '#08080a',
  },
  field: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    fontSize: 16, // 16px prevents iOS auto-zoom on focus
    fontFamily: fontFamily.bodyRegular,
    color: colors.text1,
  },
  title: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 22,
    color: colors.text1,
  },
  subtitle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 14,
    color: colors.text3,
  },
});
