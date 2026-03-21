import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';

/**
 * AccessibleText - A wrapper around React Native's Text component with
 * built-in font scaling limits for better accessibility
 *
 * Usage:
 *   <AccessibleText variant="title">Heading</AccessibleText>
 *   <AccessibleText variant="body">Description text</AccessibleText>
 */

type TextVariant = 'title' | 'heading' | 'body' | 'caption' | 'button';

interface AccessibleTextProps extends TextProps {
  variant?: TextVariant;
  children: React.ReactNode;
}

// Font size multiplier limits per variant
const MULTIPLIER_LIMITS: Record<TextVariant, number> = {
  title: 1.2,    // Strict limit for large titles
  heading: 1.2,  // Headers and section titles
  button: 1.1,   // Very strict for fixed-width buttons
  body: 1.3,     // Body text with more flexibility
  caption: 1.3,  // Small text like captions and labels
};

/**
 * AccessibleText Component
 *
 * Automatically applies appropriate maxFontSizeMultiplier based on text variant.
 * This ensures text scales for accessibility but doesn't overflow containers.
 *
 * @param variant - The type of text content (title, heading, body, caption, button)
 * @param children - The text content to display
 * @param style - Additional styles to apply
 * @param props - Any other Text props
 */
export function AccessibleText({
  variant = 'body',
  children,
  style,
  ...props
}: AccessibleTextProps) {
  const maxFontSizeMultiplier = MULTIPLIER_LIMITS[variant];

  return (
    <Text
      {...props}
      style={style}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
    >
      {children}
    </Text>
  );
}

/**
 * Convenience components for common text variants
 */

export function TitleText(props: Omit<AccessibleTextProps, 'variant'>) {
  return <AccessibleText {...props} variant="title" />;
}

export function HeadingText(props: Omit<AccessibleTextProps, 'variant'>) {
  return <AccessibleText {...props} variant="heading" />;
}

export function BodyText(props: Omit<AccessibleTextProps, 'variant'>) {
  return <AccessibleText {...props} variant="body" />;
}

export function CaptionText(props: Omit<AccessibleTextProps, 'variant'>) {
  return <AccessibleText {...props} variant="caption" />;
}

export function ButtonText(props: Omit<AccessibleTextProps, 'variant'>) {
  return <AccessibleText {...props} variant="button" />;
}

/**
 * Example Usage:
 *
 * import { TitleText, BodyText, ButtonText } from '@/components/AccessibleText';
 *
 * function MyScreen() {
 *   return (
 *     <View>
 *       <TitleText style={styles.title}>Welcome</TitleText>
 *       <BodyText style={styles.description}>
 *         This text will scale appropriately with user's accessibility settings
 *       </BodyText>
 *       <TouchableOpacity>
 *         <ButtonText style={styles.buttonText}>Click Me</ButtonText>
 *       </TouchableOpacity>
 *     </View>
 *   );
 * }
 */
