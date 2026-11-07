// src/lib/push.ts  —  push notifications: notifications appear on the phone even when the app is closed
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from './api';

// While the app is open, still show the notification as a banner
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Asks permission, gets this phone's push token, and saves it on the logged-in account.
 * Never throws: if anything fails, the app works as before with the in-app bell only.
 */
export async function registerForPush(): Promise<void> {
  try {
    if (!Device.isDevice) return; // emulators can't receive push notifications

    if (Platform.OS === 'android') {
      // Android shows notifications through a channel; "high" makes them pop up
      await Notifications.setNotificationChannelAsync('default', {
        name: 'ReliefConnect',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2E7D6B',
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return; // the user said no; the in-app bell still works

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn('Push notifications: no Expo project ID yet. Run "eas init" in the mobile folder.');
      return;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api('/me/push-token', { body: { token } });
  } catch (e) {
    console.warn('Push registration skipped:', e);
  }
}

/** Stops this phone from receiving the account's notifications (called on logout). */
export async function unregisterPush(): Promise<void> {
  await api('/me/push-token', { method: 'DELETE' }).catch(() => {});
}