import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';
import { ChevronDown } from 'lucide-react-native';

countries.registerLocale(en);

type CountryOption = {
  code: string;
  name: string;
  flag: string;
};

interface CountryPickerProps {
  value: string | null;
  onChange: (countryName: string, countryCode: string) => void;
  placeholder?: string;
  textColor: string;
  placeholderColor: string;
  borderColor: string;
  focusColor: string;
  backgroundColor: string;
}

function codeToFlag(isoCode: string): string {
  return isoCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

const ALL_COUNTRIES: CountryOption[] = Object.entries(countries.getNames('en', { select: 'official' }))
  .map(([code, name]) => ({
    code,
    name,
    flag: codeToFlag(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export default function CountryPicker({
  value,
  onChange,
  placeholder = 'Select country',
  textColor,
  placeholderColor,
  borderColor,
  focusColor,
  backgroundColor,
}: CountryPickerProps) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const filteredCountries = useMemo(() => {
    if (!debouncedQuery.trim()) return ALL_COUNTRIES;
    const q = debouncedQuery.trim().toLowerCase();
    return ALL_COUNTRIES.filter((country) => country.name.toLowerCase().includes(q) || country.code.toLowerCase().includes(q));
  }, [debouncedQuery]);

  const selectedCountry = useMemo(
    () =>
      ALL_COUNTRIES.find((country) => country.name === value) ??
      ALL_COUNTRIES.find((country) => country.code === (value || '').toUpperCase()),
    [value]
  );

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, { borderColor, backgroundColor }]}
        onPress={() => setVisible(true)}
        activeOpacity={0.9}>
        <Text style={[styles.triggerText, { color: selectedCountry ? textColor : placeholderColor }]} numberOfLines={1}>
          {selectedCountry ? `${selectedCountry.flag} ${selectedCountry.name} (${selectedCountry.code})` : placeholder}
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
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setVisible(false);
              setQuery('');
            }}
          />
          <View style={[styles.sheet, { backgroundColor }]}>
            <Text style={[styles.title, { color: textColor }]}>Select Country</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search country or code"
              placeholderTextColor={placeholderColor}
              style={[styles.searchInput, { color: textColor, borderColor, backgroundColor }]}
              autoCapitalize="none"
            />
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={24}
              maxToRenderPerBatch={48}
              windowSize={10}
              renderItem={({ item }) => {
                const isSelected = selectedCountry?.code === item.code;
                return (
                  <TouchableOpacity
                    style={[styles.row, { borderColor }, isSelected && { borderColor: focusColor, backgroundColor: `${focusColor}14` }]}
                    onPress={() => {
                      onChange(item.name, item.code);
                      setVisible(false);
                      setQuery('');
                    }}>
                    <Text style={styles.flag}>{item.flag}</Text>
                    <Text style={[styles.rowText, { color: textColor }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.code, { color: placeholderColor }]}>{item.code}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
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
  row: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  flag: {
    fontSize: 17,
  },
  rowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
  },
  code: {
    fontSize: 12,
    fontWeight: '500',
  },
});
