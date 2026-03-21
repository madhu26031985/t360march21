import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

type ColorType = 'club_info' | 'datetime' | 'footer1' | 'footer2';

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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Select Color</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.infoBox, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.infoTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{getTitle()}</Text>
          <Text style={[styles.infoText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Select a color for the banner
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Primary Colors
          </Text>
          <View style={styles.colorGrid}>
            {[
              { color: '#A9B2B1', name: 'Cool Gray' },
              { color: '#004165', name: 'Loyal Blue' },
              { color: '#772432', name: 'True Maroon' },
              { color: '#F2DF74', name: 'Happy Yellow' },
            ].map(({ color, name }) => (
              <TouchableOpacity
                key={color}
                style={[styles.colorSwatch, { backgroundColor: color }]}
                onPress={() => handleColorSelect(color)}
                disabled={saving}
              >
                {currentColor === color && (
                  <View style={styles.selectedIndicator}>
                    <Text style={styles.checkmark} maxFontSizeMultiplier={1.3}>✓</Text>
                  </View>
                )}
                <View style={styles.colorNameContainer}>
                  <Text style={[
                      styles.colorName,
                      (color === '#F2DF74' || color === '#A9B2B1') && { color: '#000' },
                    ]} maxFontSizeMultiplier={1.3}>
                    {name}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Basic Colors
          </Text>
          <View style={styles.colorGrid}>
            {[
              { color: '#000000', name: 'Black' },
              { color: '#FFFFFF', name: 'White' },
              { color: '#016094', name: 'Digital Loyal Blue' },
            ].map(({ color, name }) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: color },
                  color === '#FFFFFF' && { borderWidth: 2, borderColor: '#e5e7eb' },
                ]}
                onPress={() => handleColorSelect(color)}
                disabled={saving}
              >
                {currentColor === color && (
                  <View style={styles.selectedIndicator}>
                    <Text style={[styles.checkmark, color === '#FFFFFF' && { color: '#000' }]} maxFontSizeMultiplier={1.3}>✓</Text>
                  </View>
                )}
                <View style={styles.colorNameContainer}>
                  <Text style={[
                      styles.colorName,
                      color === '#FFFFFF' && { color: '#000' },
                    ]} maxFontSizeMultiplier={1.3}>
                    {name}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {saving && (
          <View style={styles.savingOverlay}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.savingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Saving...</Text>
          </View>
        )}
      </ScrollView>
    </View>
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
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
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
    padding: 16,
    paddingBottom: 40,
  },
  infoBox: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  colorGrid: {
    gap: 12,
  },
  colorSwatch: {
    height: 120,
    borderRadius: 16,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 12,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  colorNameContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  colorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  savingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
  },
});
