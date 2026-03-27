import { Fragment } from 'react';
import { Tabs } from 'expo-router';
import { Chrome as Home, Users, Calendar, Settings } from 'lucide-react-native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';

const FOOTER_NAV_ICON_SIZE = 15;

export default function TabLayout() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // Check if user has a club
  const hasClub = user?.currentClubId != null;

  // Check if user is ExComm in their current club
  const isExComm = user?.clubs?.find(c => c.id === user.currentClubId)?.role?.toLowerCase() === 'excomm';

  const tabBarBottomPadding = insets.bottom + 8;
  const tabBarHeight = 54 + tabBarBottomPadding;

  return (
    <Fragment>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          paddingBottom: tabBarBottomPadding,
          paddingTop: 8,
          height: tabBarHeight + 4,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: -2,
          },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 6,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarActiveTintColor: '#0a66c2',
        tabBarInactiveTintColor: '#6b7280',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 0,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4, backgroundColor: 'transparent' }}>
              <Home size={FOOTER_NAV_ICON_SIZE} color={color} />
            </View>
          ),
          href: '/(tabs)',
        }}
      />
      <Tabs.Screen
        name="club"
        options={{
          title: 'Club',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4, backgroundColor: 'transparent' }}>
              <Users size={FOOTER_NAV_ICON_SIZE} color={color} />
            </View>
          ),
          href: '/(tabs)/club',
        }}
      />
      <Tabs.Screen
        name="meetings"
        options={{
          title: 'Meetings',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4, backgroundColor: 'transparent' }}>
              <Calendar size={FOOTER_NAV_ICON_SIZE} color={color} />
            </View>
          ),
          href: hasClub ? '/(tabs)/meetings' : null,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4, backgroundColor: 'transparent' }}>
              <Settings size={FOOTER_NAV_ICON_SIZE} color={color} />
            </View>
          ),
          href: isExComm ? '/(tabs)/admin' : null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4, backgroundColor: 'transparent' }}>
              <Settings size={FOOTER_NAV_ICON_SIZE} color={color} />
            </View>
          ),
          href: '/(tabs)/settings',
        }}
      />
    </Tabs>
    </Fragment>
  );
}