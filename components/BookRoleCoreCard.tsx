import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useEffect } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { PENDING_ACTION_UI } from '@/lib/pendingActionUi';
import type { MeetingFlowTab } from '@/lib/meetingTabsCatalog';
import { Calendar, ChevronRight, AlertCircle } from 'lucide-react-native';

/** Book a Role row with pulse + border when user has no roles booked for this meeting */
export function BookRoleCoreCard({
  tab,
  description,
  showAttention,
  disabled = false,
  onPress,
}: {
  tab: Pick<MeetingFlowTab, 'id' | 'title' | 'color'>;
  description: string;
  showAttention: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const alertScale = useSharedValue(1);
  const iconPulse = useSharedValue(1);
  useEffect(() => {
    if (!showAttention) {
      alertScale.value = 1;
      iconPulse.value = 1;
      return;
    }
    alertScale.value = withRepeat(
      withSequence(withTiming(1.2, { duration: 500 }), withTiming(1, { duration: 500 })),
      -1,
      true
    );
    iconPulse.value = withRepeat(
      withSequence(withTiming(1.06, { duration: 600 }), withTiming(1, { duration: 600 })),
      -1,
      true
    );
  }, [showAttention]);
  const alertAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: alertScale.value }],
  }));
  const iconPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconPulse.value }],
  }));
  return (
    <TouchableOpacity
      style={[
        styles.keyRoleCard,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        !disabled && showAttention && styles.keyRoleCardTmodAlert,
        disabled && styles.keyRoleCardDisabled,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <Animated.View style={[styles.keyRoleIcon, { backgroundColor: tab.color + '25' }, iconPulseStyle]}>
        <Calendar size={20} color={tab.color} />
      </Animated.View>
      <View style={styles.keyRoleContent}>
        <Text
          style={[styles.keyRoleTitle, { color: disabled ? theme.colors.textSecondary : theme.colors.text }]}
          maxFontSizeMultiplier={1.3}
        >
          {tab.title}
        </Text>
        {description ? (
          <Text style={[styles.keyRoleSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
            {description}
          </Text>
        ) : null}
      </View>
      {!disabled && showAttention && (
        <Animated.View pointerEvents="box-none" style={[styles.keyRoleAlertBadge, alertAnimatedStyle]}>
          <AlertCircle size={14} color={PENDING_ACTION_UI.accent} fill={PENDING_ACTION_UI.accent} />
        </Animated.View>
      )}
      {!disabled && <ChevronRight size={20} color={theme.colors.textSecondary} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  keyRoleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
  },
  keyRoleCardTmodAlert: {
    borderColor: PENDING_ACTION_UI.border,
    borderWidth: 1.5,
  },
  keyRoleCardDisabled: {
    opacity: 0.5,
  },
  keyRoleAlertBadge: {
    marginRight: 4,
  },
  keyRoleIcon: {
    width: 40,
    height: 40,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  keyRoleContent: {
    flex: 1,
  },
  keyRoleTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  keyRoleSubtitle: {
    fontSize: 10,
    lineHeight: 14,
  },
});
