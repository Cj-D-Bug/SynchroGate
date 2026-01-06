// src/App.js
import 'react-native-gesture-handler';
import React, { useEffect } from "react";
import { SafeAreaView, StatusBar, LogBox, Platform, AppState } from "react-native";

// CRITICAL: Initialize React Native Firebase DEFAULT app FIRST
// This MUST happen before any messaging() calls
if (Platform.OS !== 'web' && typeof jest === 'undefined') {
  try {
    const { initializeFirebaseNative } = require('./src/utils/firebaseNativeInit');
    const app = initializeFirebaseNative();
    if (app) {
      console.log('✅ Firebase DEFAULT app ready in App.js');
    } else {
      console.error('❌ Firebase DEFAULT app initialization failed in App.js');
      console.error('   ACTION REQUIRED: Rebuild app - Google Services plugin must process google-services.json');
    }
  } catch (e) {
    console.error('❌ Firebase initialization error in App.js:', e?.message);
  }
}

// SAFE: Check for Jest test environment (used in multiple places)
const isJest = typeof jest !== 'undefined';

// CRITICAL: Import FCM background handler ONLY for native builds (not web)
// This registers the background message handler for native builds
// Must be imported after Platform is available but before React components
// SAFE: Wrap in try-catch to prevent app crashes
if (Platform.OS !== 'web' && !isJest) {
  try {
    require('./src/services/fcmBackgroundHandler');
  } catch (e) {
    // FCM handler not available - will use Expo notifications only
    // Don't crash - just log and continue
    console.log('ℹ️ FCM background handler not available - app will continue without FCM');
    console.log('   Error:', e?.message || 'Unknown error');
    console.log('   This is normal if app is not built with @react-native-firebase');
    // Don't throw - let app continue
  }
}
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import AppNavigator from "./src/navigation/AppNavigator";
import { AuthProvider, useAuth } from "./src/contexts/AuthContext";
import { RoleProvider } from "./src/contexts/RoleContext";
import { NetworkProvider } from "./src/contexts/NetworkContext";
import usePushNotifications from "./src/hooks/usePushNotifications";
import { triggerOfflineSync } from "./src/offline/syncWorker";
import { configureFullScreen } from "./src/utils/fullScreenUtils";
import FullScreenWrapper from "./src/components/FullScreenWrapper";
// Removed: globalPushNotificationService - backend now handles all push notifications

// React Native Firebase is now initialized in firebaseNativeInit.js (loaded above)
// No need to initialize again here

// Import FCM messaging for foreground message handler
// SAFE: Only load if available, don't crash if missing
let messaging = null;
if (Platform.OS !== 'web' && !isJest) {
  try {
    const messagingModule = require('@react-native-firebase/messaging');
    if (messagingModule && messagingModule.default && typeof messagingModule.default === 'function') {
      messaging = messagingModule.default;
      console.log('✅ FCM messaging module loaded in App.js');
    }
  } catch (e) {
    // FCM not available - will use Expo notifications only
    // Don't crash - just continue without FCM
    console.log('ℹ️ FCM messaging not available for foreground handler');
    console.log('   Error:', e?.message || 'Unknown error');
  }
}

// Configure notification behavior for background/foreground/quit states
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Ignore known warnings
LogBox.ignoreLogs([
  "Non-serializable values were found in the navigation state",
]);

function AppContent() {
  const { registerForPushNotificationsAsync } = usePushNotifications();
  const { user } = useAuth();

  useEffect(() => {
    // Set up FCM foreground message handler (when app is in foreground)
    // This handles FCM messages when app is open
    // SAFE: Only set up if messaging is available and valid
    let unsubscribeForeground = null;
    if (messaging && typeof messaging === 'function') {
      try {
        const messagingInstance = messaging();
        if (messagingInstance && typeof messagingInstance.onMessage === 'function') {
          unsubscribeForeground = messagingInstance.onMessage(async remoteMessage => {
            try {
              // Display notification using expo-notifications when app is in foreground
              // When app is closed, FCM automatically displays the notification
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: remoteMessage?.notification?.title || remoteMessage?.data?.title || 'New Alert',
                  body: remoteMessage?.notification?.body || remoteMessage?.data?.body || '',
                  data: remoteMessage?.data || {},
                  sound: true,
                  priority: Notifications.AndroidNotificationPriority.HIGH,
                },
                trigger: null, // Show immediately
              });
            } catch (notifError) {
              console.error('Error displaying FCM foreground notification:', notifError);
            }
          });
          console.log('✅ FCM Foreground message handler registered');
        }
      } catch (e) {
        console.log('ℹ️ Could not set up FCM foreground handler:', e?.message);
      }
    }

    // Set up notification response handler (when user taps notification)
    // SAFE: Wrap in try-catch to prevent crashes
    let notificationResponseSubscription = null;
    let notificationReceivedSubscription = null;
    let subscription = null;
    
    try {
      notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
        try {
          console.log('🔔 Notification tapped:', response.notification.request.content);
          // You can navigate to specific screens based on notification data here
          const data = response.notification.request.content.data;
          if (data?.type && data?.id) {
            // Handle navigation based on notification type
            console.log('🔔 Navigating from notification:', data);
          }
        } catch (listenerError) {
          console.error('❌ Error in notification response listener:', listenerError);
        }
      });
    } catch (responseError) {
      console.error('❌ Failed to add notification response listener:', responseError);
    }

    // Set up Expo notification received handler (when app is in foreground)
    try {
      notificationReceivedSubscription = Notifications.addNotificationReceivedListener(notification => {
        try {
          console.log('🔔 Expo Notification received in foreground:', notification.request.content);
        } catch (listenerError) {
          console.error('❌ Error in notification received listener:', listenerError);
        }
      });
    } catch (receivedError) {
      console.error('❌ Failed to add notification received listener:', receivedError);
    }

    // Handle app state changes to ensure notifications work
    try {
      subscription = AppState.addEventListener('change', nextAppState => {
        try {
          if (nextAppState === 'active') {
            console.log('📱 App became active - notifications should work');
          }
        } catch (stateError) {
          console.error('❌ Error in app state listener:', stateError);
        }
      });
    } catch (stateListenerError) {
      console.error('❌ Failed to add app state listener:', stateListenerError);
    }

    return () => {
      // SAFE: Cleanup with error handling
      try {
        if (unsubscribeForeground) {
          unsubscribeForeground();
        }
      } catch (unsubError) {
        console.error('❌ Error unsubscribing from FCM foreground:', unsubError);
      }
      
      try {
        if (notificationResponseSubscription) {
          notificationResponseSubscription.remove();
        }
      } catch (removeError) {
        console.error('❌ Error removing notification response subscription:', removeError);
      }
      
      try {
        if (notificationReceivedSubscription) {
          notificationReceivedSubscription.remove();
        }
      } catch (removeError) {
        console.error('❌ Error removing notification received subscription:', removeError);
      }
      
      try {
        if (subscription) {
          subscription.remove();
        }
      } catch (removeError) {
        console.error('❌ Error removing app state subscription:', removeError);
      }
    };
  }, []);

  useEffect(() => {
    if (user && user.uid) {
      console.log('🔔 Registering push notifications for user:', {
        uid: user.uid,
        role: user.role,
        hasParentId: !!user.parentId,
        hasStudentId: !!user.studentId
      });
      
      // SAFE: Wrap push notification registration in try-catch
      registerForPushNotificationsAsync(user).then(token => {
        if (token) {
          console.log('✅ Push notification registration successful');
        } else {
          console.log('ℹ️ Push notification registration returned no token');
          console.log('   This is normal if app was not built with FCM support');
          console.log('   App will continue to work, but push notifications will not be available');
        }
      }).catch(error => {
        console.log('ℹ️ Push notification registration failed:', error?.message || error);
        console.log('   App will continue to work without push notifications');
      });
      
          // DISABLED: Frontend push notification listeners are disabled
          // Backend now handles all push notifications automatically via alertPushService
          // This prevents duplicate notifications and ensures proper validation
          // try {
          //   const role = String(user.role || '').toLowerCase();
          //   if (role === 'student' || role === 'parent' || role === 'admin') {
          //     initializeGlobalPushNotifications(user);
          //   }
          // } catch (globalPushError) {
          //   console.error('❌ Failed to initialize global push notifications:', globalPushError);
          // }
    }
    
    // SAFE: Wrap utility functions in try-catch
    try {
      triggerOfflineSync();
    } catch (syncError) {
      console.error('❌ Failed to trigger offline sync:', syncError);
    }
    
    try {
      configureFullScreen();
    } catch (fullScreenError) {
      console.error('❌ Failed to configure full screen:', fullScreenError);
    }
    
        // Cleanup on unmount (disabled - frontend listeners are disabled)
        return () => {
          // Frontend listeners are disabled - backend handles everything
          // cleanupGlobalPushNotifications();
        };
  }, [user]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <FullScreenWrapper>
        <AppNavigator />
      </FullScreenWrapper>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NetworkProvider>
        <AuthProvider>
          <RoleProvider>
            <AppContent />
          </RoleProvider>
        </AuthProvider>
      </NetworkProvider>
    </SafeAreaProvider>
  );
}
