import { Tabs } from 'expo-router';
import {
  Home,
  Users,
  Calendar,
  Settings,
  Shield,
} from 'lucide-react-native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { EXCOMM_UI } from '@/lib/excommUiTokens';

const FOOTER_NAV_ICON_SIZE = 15;

const TAB_META: Record<string, { Icon: typeof Home; color: string; label: string }> = {
  index: { Icon: Home, color: '#0a66c2', label: 'Home' },
  club: { Icon: Users, color: '#d97706', label: 'Club' },
  meetings: { Icon: Calendar, color: '#0ea5e9', label: 'Meeting' },
  admin: { Icon: Shield, color: EXCOMM_UI.adminTabIcon, label: 'Admin' },
  settings: { Icon: Settings, color: '#6b7280', label: 'Settings' },
};

function MeetingStyleTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { theme } = useTheme();
  const { user } = useAuth();

  const hasClub = user?.currentClubId != null;
  const isExComm =
    user?.clubs?.find((c) => c.id === user?.currentClubId)?.role?.toLowerCase() === 'excomm';

  const focusedRoute = state.routes[state.index]?.name;

  const renderTab = (routeName: string) => {
    const meta = TAB_META[routeName];
    if (!meta) return null;
    const isFocused = focusedRoute === routeName;
    const { Icon, label } = meta;
    const inactiveColor = theme.colors.textSecondary;
    const activeColor = '#004165';
    return (
      <TouchableOpacity
        key={routeName}
        style={[
          styles.footerNavItem,
          isFocused && { backgroundColor: `${theme.colors.primary}18` },
        ]}
        onPress={() => navigation.navigate(routeName as 'index' | 'club' | 'meetings' | 'admin' | 'settings')}
        activeOpacity={0.75}
      >
        <View
          style={[
            styles.footerNavIcon,
            {
              opacity: isFocused ? 1 : 0.55,
              backgroundColor: isFocused ? `${theme.colors.primary}22` : 'transparent',
            },
          ]}
        >
          <Icon size={FOOTER_NAV_ICON_SIZE} color={isFocused ? activeColor : inactiveColor} />
        </View>
        <Text
          style={[
            styles.footerNavLabel,
            { color: isFocused ? activeColor : inactiveColor },
            isFocused && styles.footerNavLabelActive,
          ]}
          maxFontSizeMultiplier={1.3}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const tabItems = (
    <>
      {renderTab('index')}
      {hasClub ? renderTab('club') : null}
      {hasClub ? renderTab('meetings') : null}
      {isExComm ? renderTab('admin') : null}
      {renderTab('settings')}
    </>
  );

  // Mobile web: `insets.bottom` is often huge on Android Chrome (double-counting with
  // the browser/system UI), leaving a thick empty strip inside the tab bar. Cap it;
  // native apps use the real safe area.
  const tabBarBottomPadding =
    Platform.OS === 'web'
      ? Math.min(Math.max(insets.bottom, 8), 14)
      : Math.max(insets.bottom, 10);

  return (
    <View
      style={[
        styles.geBottomDock,
        {
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          paddingBottom: tabBarBottomPadding,
          width: windowWidth,
        },
      ]}
    >
      {/* Full-width row + flex:1 per tab so visible tabs share space (no shrink-wrapped ScrollView). */}
      <View style={styles.tabBarRow}>{tabItems}</View>
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
        tabBarStyle: {
          width: '100%',
          alignSelf: 'stretch',
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', href: '/(tabs)' }} />
      <Tabs.Screen
        name="club"
        options={{ title: 'Club', href: hasClub ? '/(tabs)/club' : null }}
      />
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
    paddingHorizontal: 4,
    width: '100%',
    alignSelf: 'stretch',
  },
  tabBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    alignSelf: 'stretch',
  },
  footerNavItem: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 2,
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
  footerNavLabelActive: {
    fontWeight: '700',
  },
});
