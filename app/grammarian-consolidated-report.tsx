import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, useCallback } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { ArrowLeft, Download } from 'lucide-react-native';
import { exportAgendaToPDF } from '@/lib/pdfExportUtils';
import {
  GrammarianConsolidatedReportInner,
  type GrammarianExportMeta,
} from '@/components/grammarian/GrammarianConsolidatedReportInner';

export default function GrammarianConsolidatedReport() {
  const { theme } = useTheme();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];

  const [isExporting, setIsExporting] = useState(false);
  const exportMetaRef = useRef<GrammarianExportMeta | null>(null);

  const handleExportMeta = useCallback((meta: GrammarianExportMeta | null) => {
    exportMetaRef.current = meta;
  }, []);

  useEffect(() => {
    exportMetaRef.current = null;
  }, [meetingId]);

  const handleExportPDF = async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('PDF Export', 'PDF export is available on the web version of this app.');
      return;
    }
    setIsExporting(true);
    try {
      const m = exportMetaRef.current;
      const clubName = (m?.clubName || 'Club').replace(/[^a-z0-9]/gi, '_');
      const meetingNum = m?.meetingNumber || 'X';
      const date = m?.meetingDate ? new Date(m.meetingDate).toISOString().split('T')[0] : 'date';
      const filename = `${clubName}_Meeting_${meetingNum}_Grammarian_Report_${date}.pdf`;
      await exportAgendaToPDF('grammarian-report-content', filename);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      Alert.alert('Export Failed', 'Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.navHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.navBack} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          Grammarian Review
        </Text>
        {Platform.OS === 'web' ? (
          <TouchableOpacity
            style={[styles.downloadBtn, { backgroundColor: theme.colors.primary, opacity: isExporting ? 0.6 : 1 }]}
            onPress={handleExportPDF}
            disabled={isExporting}
          >
            <Download size={16} color="#ffffff" />
            <Text style={styles.downloadBtnText} maxFontSizeMultiplier={1.2}>
              {isExporting ? 'Exporting...' : 'PDF'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 72 }} />
        )}
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <GrammarianConsolidatedReportInner
          variant="standalone"
          meetingId={meetingId}
          contentNativeID="grammarian-report-content"
          onExportMeta={handleExportMeta}
        />
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  navBack: { padding: 8, width: 40 },
  navTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  downloadBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  scroll: { flex: 1 },
});
