// src/app/_layout.tsx
import { useEffect } from 'react';
import { Stack, router, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { ResidentProvider } from '../context/ResidentContext';
import { BadgeProvider } from '../context/BadgeContext';
import '../lib/push'; // sets how notifications show while the app is open

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  // Tapping a phone notification opens the same screen as tapping it in the bell
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const link = response.notification.request.content.data?.link;
      if (typeof link === 'string' && link) router.push(link as Href);
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <ResidentProvider>
      <BadgeProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </BadgeProvider>
    </ResidentProvider>
  );
}
