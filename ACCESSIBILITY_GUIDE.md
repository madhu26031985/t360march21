# Accessibility Guide: Font Scaling Support

## Problem

When users enable large text sizes in their mobile device accessibility settings (Android: Display Size; iOS: Text Size), React Native's Text components scale automatically. Without limits, this can cause:

- Text overflowing beyond screen boundaries
- UI layouts breaking
- Poor user experience for users with visual impairments

## Solution: maxFontSizeMultiplier

We've implemented `maxFontSizeMultiplier` on all Text components throughout the app. This prop limits how much text can scale while still respecting user preferences.

### What is maxFontSizeMultiplier?

`maxFontSizeMultiplier` is a React Native Text prop that caps the maximum font size multiplier. For example:

```tsx
<Text style={{ fontSize: 16 }} maxFontSizeMultiplier={1.3}>
  Hello World
</Text>
```

With this setting:
- Default: Font is 16px
- When user has "Large" text: Font scales to ~20.8px (16 × 1.3)
- Text won't scale beyond 1.3x, preventing overflow

## Implementation Guidelines

### Default Value: 1.3

We use `1.3` as the default multiplier across the app, allowing 30% scaling which balances:
- ✅ Respecting user accessibility needs
- ✅ Maintaining UI integrity
- ✅ Preventing text overflow

### When to Adjust

**Use 1.1-1.2 for:**
- Headers and titles that must not break layout
- Tab bar labels
- Button text in fixed-width containers
- Badge text and chips
- Navigation elements

**Use 1.3-1.5 for:**
- Body text and descriptions
- Paragraphs
- Long-form content
- List items with ample space

## Examples

### Header Text (Strict Control)
```tsx
<Text
  style={styles.clubName}
  numberOfLines={1}
  ellipsizeMode="tail"
  maxFontSizeMultiplier={1.2}
>
  {clubInfo?.club_name}
</Text>
```

### Body Text (More Flexible)
```tsx
<Text
  style={styles.description}
  maxFontSizeMultiplier={1.3}
>
  {item.section_description}
</Text>
```

### Combined with numberOfLines
```tsx
<Text
  style={styles.title}
  numberOfLines={2}
  ellipsizeMode="tail"
  maxFontSizeMultiplier={1.2}
>
  {longTitle}
</Text>
```

## Testing Font Scaling

### On iOS Simulator
1. Settings → Accessibility → Display & Text Size → Larger Text
2. Drag slider to "Large" or "Extra Large"
3. Test your app

### On Android Emulator
1. Settings → Display → Font size
2. Select "Large" or "Largest"
3. Test your app

### On Physical Devices
1. Enable large text in device settings
2. Navigate through all screens
3. Check for:
   - Text overflow
   - Layout breaks
   - Unreadable content

## Automated Fix

A script is available to add `maxFontSizeMultiplier` to any new screens:

```bash
node scripts/add-font-size-multiplier.js
```

This script:
- Scans all `.tsx` files in `app/` and `components/`
- Adds `maxFontSizeMultiplier={1.3}` to Text components missing it
- Reports which files were updated

## Status

✅ **Applied to 119 files** across the entire app
- All app screens
- All components
- All modals and forms

## Additional Accessibility Considerations

Beyond font scaling, consider:

1. **Color Contrast**: Ensure text meets WCAG guidelines
2. **Touch Targets**: Minimum 44x44 points for interactive elements
3. **Screen Reader Support**: Use `accessibilityLabel` and `accessibilityHint`
4. **Keyboard Navigation**: Support for external keyboards on tablets

## Resources

- [React Native Text Props](https://reactnative.dev/docs/text#maxfontsizemultiplier)
- [iOS Human Interface Guidelines - Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- [Material Design - Accessibility](https://material.io/design/usability/accessibility.html)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
