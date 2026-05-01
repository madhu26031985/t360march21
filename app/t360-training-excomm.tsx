import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ChevronRight, Building2, UserPlus, Calendar, ListChecks, Vote } from 'lucide-react-native';

const N = {
  page: '#FBFBFA',
  surface: '#FFFFFF',
  border: 'rgba(55, 53, 47, 0.09)',
  text: '#37352F',
  textSecondary: '#787774',
  textTertiary: 'rgba(55, 53, 47, 0.45)',
};

type PlaceholderRowProps = {
  title: string;
  hideBottomBorder?: boolean;
  icon: React.ReactNode;
};

function PlaceholderRow({ title, hideBottomBorder, icon }: PlaceholderRowProps) {
  return (
    <TouchableOpacity style={[styles.row, hideBottomBorder && styles.rowNoBorder]} activeOpacity={0.7} onPress={() => {}}>
      <View style={styles.rowLeft}>
        <View style={styles.iconTile}>{icon}</View>
        <View style={styles.textWrap}>
          <Text style={styles.rowTitle} maxFontSizeMultiplier={1.3}>
            {title}
          </Text>
          <Text style={styles.rowDesc} maxFontSizeMultiplier={1.25}>
            Placeholder
          </Text>
        </View>
      </View>
      <ChevronRight size={16} color={N.textTertiary} strokeWidth={2} />
    </TouchableOpacity>
  );
}

export default function T360TrainingExcommScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={N.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>
          Excomm training
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.group}>
        <PlaceholderRow title="Create a club" icon={<Building2 size={18} color="#2563EB" strokeWidth={1.8} />} />
        <PlaceholderRow title="Invite members" icon={<UserPlus size={18} color="#16A34A" strokeWidth={1.8} />} />
        <PlaceholderRow title="Manage meetings" icon={<Calendar size={18} color="#0EA5E9" strokeWidth={1.8} />} />
        <PlaceholderRow title="Agenda creation" icon={<ListChecks size={18} color="#D97706" strokeWidth={1.8} />} />
        <PlaceholderRow
          title="Voting operations"
          icon={<Vote size={18} color="#7C3AED" strokeWidth={1.8} />}
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
