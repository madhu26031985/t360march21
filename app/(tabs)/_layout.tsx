import { Tabs } from 'expo-router';
import { Chrome as Home, Users, Calendar, Settings, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';

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
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          paddingBottom: tabBarBottomPadding,
          paddingTop: 4,
          height: tabBarHeight,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: -1,
          },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 4,
        },
        tabBarActiveTintColor: '#0a66c2',
        tabBarInactiveTintColor: '#6b7280',
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: '600',
          marginTop: 2,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Journey',
          tabBarIcon: ({ size, color }) => (
            <Home size={18} color={color} />
          ),
          href: '/(tabs)',
        }}
      />
      <Tabs.Screen
        name="club"
        options={{
          title: 'Club',
          tabBarIcon: ({ size, color }) => (
            <Users size={18} color={color} />
          ),
          href: '/(tabs)/club',
        }}
      />
      <Tabs.Screen
        name="meetings"
        options={{
          title: 'Meetings',
          tabBarIcon: ({ size, color }) => (
            <Calendar size={18} color={color} />
          ),
          href: hasClub ? '/(tabs)/meetings' : null,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          tabBarIcon: ({ size, color }) => (
            <Settings size={18} color={color} />
          ),
          href: isExComm ? '/(tabs)/admin' : null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ size, color }) => (
            <User size={18} color={color} />
          ),
          href: '/(tabs)/settings',
        }}
      />
    </Tabs>
  );
}