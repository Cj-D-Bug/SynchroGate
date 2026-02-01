import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { height } = Dimensions.get('window');

/**
 * Offline banner component that displays "No internet connection" message
 * Appears at the bottom of screen (similar to developer options badge)
 * Dark transparent styling, does not auto-dismiss
 * Animation only plays on initial show/hide, not on navigation
 */
const OfflineBanner = ({ visible }) => {
  const [slideAnim] = useState(new Animated.Value(visible ? 0 : 100));
  const previousVisibleRef = useRef(visible);

  useEffect(() => {
    // Only animate if visibility actually changed (not on remount)
    if (visible !== previousVisibleRef.current) {
      if (visible) {
        // Slide in from bottom (only if wasn't visible before)
        slideAnim.setValue(100);
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      } else {
        // Slide out to bottom
        Animated.timing(slideAnim, {
          toValue: 100,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
      previousVisibleRef.current = visible;
    } else if (visible) {
      // If already visible and navigating, keep at position 0 (no animation)
      slideAnim.setValue(0);
    }
  }, [visible, slideAnim]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Ionicons name="cloud-offline-outline" size={16} color="#FFFFFF" />
      <Text style={styles.bannerText}>No internet connection</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    bottom: 20,
    left: '50%',
    marginLeft: -100, // Center the badge (approximately half of minWidth)
    minWidth: 200,
    backgroundColor: 'rgba(0, 0, 0, 0.7)', // Dark transparent
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 9999,
    elevation: 9999,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default OfflineBanner;

