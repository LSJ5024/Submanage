/**
 * SubTrack 앱 스토어 메타 정보 (TASK-062)
 * iOS App Store (iOS 15.0+) / Google Play Store (Android 10.0+)
 */
export default {
  name:        'SubTrack',
  slug:        'subtrack',
  version:     '1.0.0',
  orientation: 'portrait',
  scheme:      'subtrack',

  icon:        './assets/icon.png',
  splash: {
    image:           './assets/splash.png',
    resizeMode:      'contain',
    backgroundColor: '#5B67F8',
  },

  ios: {
    bundleIdentifier:    'app.subtrack.ios',
    buildNumber:         '1',
    supportsTablet:      false,
    requireFullScreen:   true,
    deploymentTarget:    '15.0', // CLAUDE.md §2 — iOS 15.0+
    infoPlist: {
      NSCameraUsageDescription:           'QR 코드 스캔을 위해 카메라 권한이 필요합니다.',
      NSUserNotificationsUsageDescription:'결제 D-3 알림 발송을 위해 알림 권한이 필요합니다.',
      NSFaceIDUsageDescription:           '안전한 로그인을 위해 Face ID 권한이 필요합니다.',
    },
    entitlements: {
      'com.apple.developer.associated-domains': ['applinks:subtrack.app'],
    },
  },

  android: {
    package:         'app.subtrack.android',
    versionCode:     1,
    minSdkVersion:   29,         // Android 10.0 (CLAUDE.md §2)
    targetSdkVersion:34,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#5B67F8',
    },
    permissions: [
      'android.permission.INTERNET',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.VIBRATE',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.USE_BIOMETRIC',
      'android.permission.USE_FINGERPRINT',
    ],
    intentFilters: [{
      action: 'VIEW',
      autoVerify: true,
      data: [{ scheme: 'https', host: 'subtrack.app' }],
      category: ['BROWSABLE', 'DEFAULT'],
    }],
  },

  plugins: [
    'expo-router',
    ['expo-notifications', {
      icon:  './assets/notification-icon.png',
      color: '#5B67F8',
    }],
  ],

  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://api.subtrack.app/api/v1',
    eas: { projectId: 'REPLACE_WITH_EAS_PROJECT_ID' },
  },
};
