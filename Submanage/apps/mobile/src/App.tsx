import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text } from 'react-native';

import { useAuthStore } from './stores/auth.store';
import LoginScreen from './screens/auth/LoginScreen';
import RegisterScreen from './screens/auth/RegisterScreen';
import DashboardScreen from './screens/dashboard/DashboardScreen';
import SubscriptionDetailScreen from './screens/subscriptions/SubscriptionDetailScreen';
import CancelGuideScreen from './screens/subscriptions/CancelGuideScreen';
import CardLinkScreen from './screens/cards/CardLinkScreen';
import NotificationSettingsScreen from './screens/notifications/NotificationSettingsScreen';
import ReportScreen from './screens/reports/ReportScreen';

export type RootStackParamList = {
  MainTabs: undefined;
  Login: undefined;
  Register: undefined;
  SubscriptionDetail: { id: string };
  CancelGuide: { id: string; serviceName: string };
};

export type TabParamList = {
  Dashboard: undefined;
  Report: undefined;
  CardLink: undefined;
  NotificationSettings: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab   = createBottomTabNavigator<TabParamList>();

function TabIcon({ label, emoji }: { label: string; emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle:     { backgroundColor: '#FFFFFF' },
        headerTintColor: '#1A1D2E',
        headerTitleStyle:{ fontWeight: '700' },
        tabBarActiveTintColor:   '#5B67F8',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: { borderTopColor: '#E4E7F0', paddingBottom: 4 },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title:        '대시보드',
          tabBarLabel:  '홈',
          tabBarIcon:   () => <TabIcon label="홈" emoji="📊" />,
        }}
      />
      <Tab.Screen
        name="Report"
        component={ReportScreen}
        options={{
          title:       '지출 리포트',
          tabBarLabel: '리포트',
          tabBarIcon:  () => <TabIcon label="리포트" emoji="📈" />,
        }}
      />
      <Tab.Screen
        name="CardLink"
        component={CardLinkScreen}
        options={{
          title:       '카드 연동',
          tabBarLabel: '카드',
          tabBarIcon:  () => <TabIcon label="카드" emoji="💳" />,
        }}
      />
      <Tab.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{
          title:       '알림 설정',
          tabBarLabel: '알림',
          tabBarIcon:  () => <TabIcon label="알림" emoji="🔔" />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle:     { backgroundColor: '#FFFFFF' },
          headerTintColor: '#1A1D2E',
          headerTitleStyle:{ fontWeight: '700' },
        }}
      >
        {!isLoggedIn ? (
          <>
            <Stack.Screen name="Login"    component={LoginScreen}    options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: '회원가입' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="SubscriptionDetail" component={SubscriptionDetailScreen} options={{ title: '구독 상세' }} />
            <Stack.Screen name="CancelGuide"        component={CancelGuideScreen}        options={({ route }) => ({ title: `${route.params.serviceName} 해지 안내` })} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
