import { useEffect, useMemo, useState } from 'react';
import { Modal, SectionList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import moment from 'moment-timezone';
import { ChevronDown } from 'lucide-react-native';

type TimezoneOption = {
  value: string;
  label: string;
  offset: string;
  region: string;
};

interface TimezonePickerProps {
  value: string | null;
  onChange: (timezone: string) => void;
  placeholder?: string;
  textColor: string;
  placeholderColor: string;
  borderColor: string;
  focusColor: string;
  backgroundColor: string;
}

function toOffset(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `GMT${sign}${hh}:${mm}`;
}

const ALL_TIMEZONES: TimezoneOption[] = moment.tz.names().map((tz) => {
  const offsetMinutes = moment.tz(tz).utcOffset();
  const region = tz.split('/')[0] || 'Other';
  return {
    value: tz,
    label: tz,
    offset: toOffset(offsetMinutes),
    region,
  };
});

export default function TimezonePicker({
  value,
  onChange,
  placeholder = 'Select timezone',
  textColor,
  placeholderColor,
  borderColor,
  focusColor,
  backgroundColor,
}: TimezonePickerProps) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const filtered = useMemo(() => {
    if (!debouncedQuery.trim()) return ALL_TIMEZONES;
    const q = debouncedQuery.trim().toLowerCase();
    return ALL_TIMEZONES.filter((item) => `${item.label} ${item.offset} ${item.region}`.toLowerCase().includes(q));
  }, [debouncedQuery]);

  const sections = useMemo(() => {
    const grouped = filtered.reduce<Record<string, TimezoneOption[]>>((acc, item) => {
      if (!acc[item.region]) acc[item.region] = [];
      acc[item.region].push(item);
      return acc;
    }, {});
    return Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b))
      .map((region) => ({
        title: region,
        data: grouped[region].sort((a, b) => a.label.localeCompare(b.label)),
      }));
  }, [filtered]);

  const selected = useMemo(() => ALL_TIMEZONES.find((item) => item.value === value), [value]);

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, { borderColor, backgroundColor }]}
        onPress={() => setVisible(true)}
        activeOpacity={0.9}>
        <Text style={[styles.triggerText, { color: selected ? textColor : placeholderColor }]} numberOfLines={1}>
          {selected ? `${selected.label} — ${selected.offset}` : placeholder}
        </Text>
        <ChevronDown size={16} color={placeholderColor} />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setVisible(false);
          setQuery('');
        }}>
        <TouchableOpacity
          style={styles.overlay}
          onPress={() => {
            setVisible(false);
            setQuery('');
          }}>
          <View style={[styles.sheet, { backgroundColor }]}>
            <Text style={[styles.title, { color: textColor }]}>Select Timezone</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search timezone, city, or GMT"
              placeholderTextColor={placeholderColor}
              style={[styles.searchInput, { color: textColor, borderColor, backgroundColor }]}
              autoCapitalize="none"
            />

            <SectionList
              sections={sections}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={30}
              maxToRenderPerBatch={50}
              windowSize={12}
              stickySectionHeadersEnabled
              renderSectionHeader={({ section }) => (
                <Text style={[styles.sectionHeader, { color: placeholderColor }]}>{section.title}</Text>
              )}
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <TouchableOpacity
                    style={[styles.row, { borderColor }, isSelected && { borderColor: focusColor, backgroundColor: `${focusColor}14` }]}
                    onPress={() => {
                      onChange(item.value);
                      setVisible(false);
                      setQuery('');
                    }}>
                    <Text style={[styles.rowText, { color: textColor }]} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <Text style={[styles.offset, { color: placeholderColor }]}>{item.offset}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  triggerText: {
    fontSize: 15,
    fontWeight: '400',
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.22)',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: {
    borderRadius: 14,
    padding: 16,
    maxHeight: '78%',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 6,
    paddingHorizontal: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  rowText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
  },
  offset: {
    fontSize: 12,
    fontWeight: '500',
  },
});
