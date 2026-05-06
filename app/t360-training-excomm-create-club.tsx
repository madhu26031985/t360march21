import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

const N = {
  page: '#FBFBFA',
  surface: '#FFFFFF',
  border: 'rgba(55, 53, 47, 0.09)',
  text: '#37352F',
  textSecondary: '#787774',
};

const STEPS = [
  'Go to Settings',
  'Tap Create new club',
  'Enter Club Name',
  'Enter Club Number & Charter Date',
  'Tap Create Club',
];

export default function T360TrainingExcommCreateClubScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={N.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>
          Create a club
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title} maxFontSizeMultiplier={1.35}>
            How to Create a Club (T360)
          </Text>

          {STEPS.map((step, i) => (
            <View key={step} style={styles.stepRow}>
              <Text style={styles.stepNum} maxFontSizeMultiplier={1.25}>
                {i + 1}.
              </Text>
              <Text style={styles.stepText} maxFontSizeMultiplier={1.25}>
                {step}
              </Text>
            </View>
          ))}

          <Text style={styles.done} maxFontSizeMultiplier={1.25}>
            ✅ Your club is ready to use!
          </Text>
        </View>
      </ScrollView>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: N.surface,
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 14,
    padding: 18,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: N.text,
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  stepNum: {
    fontSize: 15,
    fontWeight: '600',
    color: N.textSecondary,
    minWidth: 22,
  },
  stepText: {
    flex: 1,
    marginLeft: 6,
    fontSize: 15,
    lineHeight: 22,
    color: N.text,
  },
  done: {
    marginTop: 14,
    fontSize: 15,
    lineHeight: 22,
    color: N.text,
  },
});
