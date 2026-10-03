// src/app/(resident)/_layout.tsx
import { Tabs } from 'expo-router';
import ResidentTabBar from '../../components/ResidentTabBar';

export default function ResidentLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <ResidentTabBar {...props} />}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="announcements" />
      <Tabs.Screen name="account" />
      {/* <Tabs.Screen name="sos" />  — SOS disabled for now */}
    </Tabs>
  );
}