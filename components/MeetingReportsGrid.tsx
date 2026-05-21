import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Search, ChevronRight } from 'lucide-react-native';
import { MEETING_REPORT_CATEGORIES } from '@/lib/meetingReportsCatalog';

export type MeetingReportsTheme = {
  colors: {
    text: string;
    textSecondary: string;
    border: string;
    surface: string;
    background: string;
  };
};

type Props = {
  theme: MeetingReportsTheme;
  onReportPress: (path: string) => void;
  showHeader?: boolean;
};

/** Full-width list rows — same layout as Meeting Actions → Core → Book a Role */
export function MeetingReportsGrid({ theme, onReportPress, showHeader = true }: Props) {
  const [query, setQuery] = useState('');

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MEETING_REPORT_CATEGORIES;
    return MEETING_REPORT_CATEGORIES.map((category) => ({
      ...category,
      reports: category.reports.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          category.title.toLowerCase().includes(q)
      ),
    })).filter((c) => c.reports.length > 0);
  }, [query]);

  return (
    <View style={styles.root}>
      {showHeader ? (
        <View style={styles.headerBlock}>
          <Text style={[styles.pageTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
            Meeting Reports
          </Text>
          <Text style={[styles.pageSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
            Explore and analyze your meeting data
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.searchWrap,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <Search size={18} color={theme.colors.textSecondary} strokeWidth={2} />
        <TextInput
          style={[styles.searchInput, { color: theme.colors.text }]}
          placeholder="Search reports..."
          placeholderTextColor={theme.colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel="Search reports"
        />
      </View>

      {filteredCategories.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
          No reports match your search.
        </Text>
      ) : (
        filteredCategories.map((category) => (
          <View key={category.id} style={styles.categoryBlock}>
            <Text style={[styles.categoryTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {category.title}
            </Text>
            <View style={[styles.categoryDivider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.reportsList}>
              {category.reports.map((report) => {
                const Icon = report.Icon;
                return (
                  <TouchableOpacity
                    key={report.id}
                    style={[
                      styles.reportRow,
                      { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                    ]}
                    onPress={() => onReportPress(report.path)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={report.title}
                  >
                    <View style={[styles.reportIcon, { backgroundColor: report.color + '25' }]}>
                      <Icon size={20} color={report.color} strokeWidth={1.75} />
                    </View>
                    <View style={styles.reportContent}>
                      <Text style={[styles.reportTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        {report.title}
                      </Text>
                      <Text
                        style={[styles.reportSubtitle, { color: theme.colors.textSecondary }]}
                        maxFontSizeMultiplier={1.2}
                      >
                        {report.description}
                      </Text>
                    </View>
                    <ChevronRight size={20} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  headerBlock: {
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 4,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
  categoryBlock: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  categoryDivider: {
    height: 1,
    marginBottom: 12,
  },
  reportsList: {
    gap: 10,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reportIcon: {
    width: 40,
    height: 40,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reportContent: {
    flex: 1,
    minWidth: 0,
  },
  reportTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  reportSubtitle: {
    fontSize: 10,
    lineHeight: 14,
  },
});
