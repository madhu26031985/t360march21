import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ChevronRight, GraduationCap, Users } from 'lucide-react-native';

const N = {
  page: '#FBFBFA',
  surface: '#FFFFFF',
  border: 'rgba(55, 53, 47, 0.09)',
  text: '#37352F',
  textSecondary: '#787774',
  textTertiary: 'rgba(55, 53, 47, 0.45)',
};

type TrainingRowProps = {
  title: string;
  description: string;
  icon: React.ReactNode;
  hideBottomBorder?: boolean;
  onPress?: () => void;
};

function TrainingRow({ title, description, icon, hideBottomBorder, onPress }: TrainingRowProps) {
  return (
    <TouchableOpacity style={[styles.row, hideBottomBorder && styles.rowNoBorder]} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.rowLeft}>
        <View style={styles.iconTile}>{icon}</View>
        <View style={styles.textWrap}>
          <Text style={styles.rowTitle} maxFontSizeMultiplier={1.3}>
            {title}
          </Text>
          <Text style={styles.rowDesc} maxFontSizeMultiplier={1.25}>
            {description}
          </Text>
        </View>
      </View>
      <ChevronRight size={16} color={N.textTertiary} strokeWidth={2} />
    </TouchableOpacity>
  );
}

export default function T360TrainingScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={N.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>
          T360 training
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.group}>
        <TrainingRow
          icon={<Users size={18} color="#2563EB" strokeWidth={1.8} />}
          title="Excomm training"
          description="Placeholder"
          onPress={() => router.push('/t360-training-excomm')}
        />
        <TrainingRow
          icon={<GraduationCap size={18} color="#7C3AED" strokeWidth={1.8} />}
          title="Roles training"
          description="Placeholder"
          hideBottomBorder
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: N.page,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: N.surface,
    borderWidth: 1,
    borderColor: N.border,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: N.text,
    fontSize: 20,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  group: {
    backgroundColor: N.surface,
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: N.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowNoBorder: {
    borderBottomWidth: 0,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconTile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: 'rgba(55, 53, 47, 0.06)',
  },
  textWrap: {
    flex: 1,
  },
  rowTitle: {
    color: N.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  rowDesc: {
    color: N.textSecondary,
    fontSize: 13,
  },
});
