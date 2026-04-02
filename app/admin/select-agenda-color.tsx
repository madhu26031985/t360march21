import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

type ColorType = 'club_info' | 'datetime' | 'footer1' | 'footer2';

const PRIMARY_COLORS = [
  { color: '#A9B2B1', name: 'Cool Gray' },
  { color: '#004165', name: 'Loyal Blue' },
  { color: '#772432', name: 'True Maroon' },
  { color: '#F2DF74', name: 'Happy Yellow' },
] as const;

const BASIC_COLORS = [
  { color: '#000000', name: 'Black' },
  { color: '#FFFFFF', name: 'White' },
  { color: '#016094', name: 'Digital Loyal Blue' },
] as const;

export default function SelectAgendaColorScreen() {
  const { theme } = useTheme();
  const params = useLocalSearchParams<{
    meetingId: string;
    colorType: ColorType;
    currentColor: string;
  }>();

  const [currentColor, setCurrentColor] = useState(params.currentColor || '#772432');
  const [saving, setSaving] = useState(false);

  const getTitle = () => {
    switch (params.colorType) {
      case 'club_info':
        return 'Club Info Banner Color';
      case 'datetime':
        return 'Date/Time Banner Color';
      case 'footer1':
        return 'Footer Banner 1 Color';
      case 'footer2':
        return 'Footer Banner 2 Color';
      default:
        return 'Select Color';
    }
  };

  const handleColorSelect = async (color: string) => {
    setCurrentColor(color);
    setSaving(true);

    try {
      const columnMap: Record<ColorType, string> = {
        club_info: 'club_info_banner_color',
        datetime: 'datetime_banner_color',
        footer1: 'footer_banner_1_color',
        footer2: 'footer_banner_2_color',
      };

      const { error } = await supabase
        .from('app_club_meeting')
        .update({ [columnMap[params.colorType]]: color })
        .eq('id', params.meetingId);

      if (error) throw error;

      router.back();
    } catch (error) {
      console.error('Error updating color:', error);
      Alert.alert('Error', 'Failed to update color');
    } finally {
      setSaving(false);
    }
  };

  const renderColorRow = (hex: string, name: string, opts: { isLast: boolean }) => {
    const selected = currentColor === hex;

    return (
      <TouchableOpacity
        key={hex}
        style={[
          styles.colorListRow,
          !opts.isLast && {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.colors.border,
          },
        ]}
        onPress={() => handleColorSelect(hex)}
        disabled={saving}
        activeOpacity={0.65}
      >
        <View
          style={[
            styles.colorListSwatch,
            { backgroundColor: hex },
            hex === '#FFFFFF' && {
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.colors.border,
            },
          ]}
        />
        <Text style={[styles.colorListName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          {name}
        </Text>
        <View style={styles.colorListTrailing}>
          {selected ? (
            <View
              style={[
                styles.colorListCheck,
                {
                  borderColor: theme.colors.primary,
                  backgroundColor: theme.colors.surface,
                },
              ]}
            >
              <Check size={16} color={theme.colors.primary} />
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View
        style={[
          styles.header,
          { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          Select Color
        </Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.notionSheet,
            { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
          ]}
        >
          <View
            style={[
              styles.notionContextBlock,
              { borderBottomColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.contextTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {getTitle()}
            </Text>
            <Text style={[styles.contextSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.25}>
              Select a color for the banner
            </Text>
          </View>

          <View
            style={[
              styles.notionSectionLabelRow,
              { borderBottomColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.notionSectionLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
              Primary Colors
            </Text>
          </View>
          {PRIMARY_COLORS.map((item) => renderColorRow(item.color, item.name, { isLast: false }))}

          <View
            style={[
              styles.notionSectionLabelRow,
              { borderBottomColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.notionSectionLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
              Basic Colors
            </Text>
          </View>
          {BASIC_COLORS.map((item, index) =>
            renderColorRow(item.color, item.name, {
              isLast: index === BASIC_COLORS.length - 1,
            })
          )}
        </View>
      </ScrollView>

      {saving ? (
        <View style={[StyleSheet.absoluteFillObject, styles.savingOverlay]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.savingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Saving...
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  notionSheet: {
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  notionContextBlock: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  contextTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  contextSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  notionSectionLabelRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  notionSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  colorListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 56,
  },
  colorListSwatch: {
    width: 36,
    height: 36,
    borderRadius: 0,
  },
  colorListName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  colorListTrailing: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorListCheck: {
    width: 28,
    height: 28,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savingOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  savingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
  },
});
