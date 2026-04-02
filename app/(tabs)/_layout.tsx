import { useCallback } from 'react';
import { Tabs, router } from 'expo-router';
import {
  Home,
  Users,
  Calendar,
  Settings,
  Coffee,
  MessageCircle,
  Globe,
  Shield,
} from 'lucide-react-native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

const FOOTER_NAV_ICON_SIZE = 15;
const T360_WEB_LOGIN_URL = 'https://t360.in/weblogin';
const T360_WHATSAPP_SUPPORT_URL = 'https://wa.me/9597491113';

const TAB_META: Record<string, { Icon: typeof Home; color: string; label: string }> = {
  index: { Icon: Home, color: '#0a66c2', label: 'Home' },
  club: { Icon: Users, color: '#d97706', label: 'Club' },
  meetings: { Icon: Calendar, color: '#0ea5e9', label: 'Meeting' },
  admin: { Icon: Shield, color: '#7c3aed', label: 'Admin' },
  settings: { Icon: Settings, color: '#6b7280', label: 'Settings' },
};

function MeetingStyleTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();

  const hasClub = user?.currentClubId != null;
  const isExComm =
    user?.clubs?.find((c) => c.id === user?.currentClubId)?.role?.toLowerCase() === 'excomm';

  const focusedRoute = state.routes[state.index]?.name;

  const openWhatsAppSupport = useCallback(async () => {
    try {
      const supported = await Linking.canOpenURL(T360_WHATSAPP_SUPPORT_URL);
      if (supported) await Linking.openURL(T360_WHATSAPP_SUPPORT_URL);
      else Alert.alert('Error', 'Cannot open WhatsApp');
    } catch {
      Alert.alert('Error', 'Failed to open WhatsApp');
    }
  }, []);

  const openWebLogin = useCallback(async () => {
    try {
      const supported = await Linking.canOpenURL(T360_WEB_LOGIN_URL);
      if (supported) await Linking.openURL(T360_WEB_LOGIN_URL);
      else Alert.alert('Error', 'Cannot open web login');
    } catch {
      Alert.alert('Error', 'Failed to open web login');
    }
  }, []);

  const renderTab = (routeName: string) => {
    const meta = TAB_META[routeName];
    if (!meta) return null;
    const isFocused = focusedRoute === routeName;
    const { Icon, color, label } = meta;
    return (
      <TouchableOpacity
        key={routeName}
        style={styles.footerNavItem}
        onPress={() => navigation.navigate(routeName as 'index' | 'club' | 'meetings' | 'admin' | 'settings')}
        activeOpacity={0.75}
      >
        <View style={[styles.footerNavIcon, { opacity: isFocused ? 1 : 0.5 }]}>
          <Icon size={FOOTER_NAV_ICON_SIZE} color={color} />
        </View>
        <Text
          style={[
            styles.footerNavLabel,
            { color: isFocused ? theme.colors.primary : theme.colors.textSecondary },
          ]}
          maxFontSizeMultiplier={1.3}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[
        styles.geBottomDock,
        {
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.footerNavigationContent}
      >
        {renderTab('index')}
        {renderTab('club')}
        {hasClub ? renderTab('meetings') : null}
        {isExComm ? renderTab('admin') : null}
        {renderTab('settings')}
        <TouchableOpacity
          style={styles.footerNavItem}
          onPress={() => router.push('/buy-us-a-coffee')}
          activeOpacity={0.75}
        >
          <View style={styles.footerNavIcon}>
            <Coffee size={FOOTER_NAV_ICON_SIZE} color="#92400e" />
          </View>
          <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Coffee
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerNavItem} onPress={openWhatsAppSupport} activeOpacity={0.75}>
          <View style={styles.footerNavIcon}>
            <MessageCircle size={FOOTER_NAV_ICON_SIZE} color="#22c55e" />
          </View>
          <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Support
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerNavItem} onPress={openWebLogin} activeOpacity={0.75}>
          <View style={styles.footerNavIcon}>
            <Globe size={FOOTER_NAV_ICON_SIZE} color="#334155" />
          </View>
          <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Web
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

export default function TabLayout() {
  const { user } = useAuth();

  const hasClub = user?.currentClubId != null;
  const isExComm =
    user?.clubs?.find((c) => c.id === user.currentClubId)?.role?.toLowerCase() === 'excomm';

  return (
    <Tabs
      tabBar={(props) => <MeetingStyleTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', href: '/(tabs)' }} />
      <Tabs.Screen name="club" options={{ title: 'Club', href: '/(tabs)/club' }} />
      <Tabs.Screen
        name="meetings"
        options={{
          title: 'Meetings',
          href: hasClub ? '/(tabs)/meetings' : null,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: isExComm ? '/(tabs)/admin' : null,
        }}
      />
      <Tabs.Screen name="settings" options={{ title: 'Settings', href: '/(tabs)/settings' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  geBottomDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingHorizontal: 8,
  },
  footerNavigationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  footerNavItem: {
    alignItems: 'center',
    minWidth: 62,
    paddingVertical: 2,
  },
  footerNavIcon: {
    width: 30,
    height: 30,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  footerNavLabel: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
  },
});
