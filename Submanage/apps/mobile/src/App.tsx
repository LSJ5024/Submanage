import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import { useAuthStore } from './stores/auth.store';
import LoginScreen from './screens/auth/LoginScreen';
import RegisterScreen from './screens/auth/RegisterScreen';
import DashboardScreen from './screens/dashboard/DashboardScreen';
import SubscriptionDetailScreen from './screens/subscriptions/SubscriptionDetailScreen';
import CancelGuideScreen from './screens/subscriptions/CancelGuideScreen';
import CardLinkScreen from './screens/cards/CardLinkScreen';
import NotificationSettingsScreen from './screens/notifications/NotificationSettingsScreen';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Dashboard: undefined;
  SubscriptionDetail: { id: string };
  CancelGuide: { id: string; serviceName: string };
  CardLink: undefined;
  NotificationSettings: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#1A1D2E',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        {!isLoggedIn ? (
          <>
            <Stack.Screen name="Login"    component={LoginScreen}    options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: '회원가입' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Dashboard"           component={DashboardScreen}           options={{ title: 'SubTrack', headerLeft: () => null }} />
            <Stack.Screen name="SubscriptionDetail"  component={SubscriptionDetailScreen}  options={{ title: '구독 상세' }} />
            <Stack.Screen name="CancelGuide"         component={CancelGuideScreen}         options={({ route }) => ({ title: `${route.params.serviceName} 해지 안내` })} />
            <Stack.Screen name="CardLink"            component={CardLinkScreen}            options={{ title: '카드 연동' }} />
            <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ title: '알림 설정' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
