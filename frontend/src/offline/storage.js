import AsyncStorage from '@react-native-async-storage/async-storage';

export const setItem = async (key, value) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('AsyncStorage setItem error:', err);
  }
};

export const getItem = async (key) => {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    console.error('AsyncStorage getItem error:', err);
    return null;
  }
};

export const removeItem = async (key) => {
  try {
    await AsyncStorage.removeItem(key);
  } catch (err) {
    console.error('AsyncStorage removeItem error:', err);
  }
};

export const clearStorage = async () => {
  try {
    await AsyncStorage.clear();
  } catch (err) {
    console.error('AsyncStorage clear error:', err);
  }
};

// Offline cache utilities for dashboard data
export const cacheDashboardData = async (userId, role, data) => {
  try {
    const cacheKey = `dashboard_cache_${role}_${userId}`;
    const cacheData = {
      data,
      timestamp: Date.now(),
    };
    await setItem(cacheKey, cacheData);
  } catch (err) {
    console.error('Error caching dashboard data:', err);
  }
};

export const getCachedDashboardData = async (userId, role) => {
  try {
    const cacheKey = `dashboard_cache_${role}_${userId}`;
    const cached = await getItem(cacheKey);
    if (cached && cached.timestamp) {
      // Cache is valid for 24 hours
      const cacheAge = Date.now() - cached.timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (cacheAge < maxAge) {
        return cached.data;
      }
    }
    return null;
  } catch (err) {
    console.error('Error getting cached dashboard data:', err);
    return null;
  }
};

// Cache user session for offline access
export const cacheUserSession = async (userData) => {
  try {
    await setItem('offline_user_session', {
      user: userData,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error('Error caching user session:', err);
  }
};

export const getCachedUserSession = async () => {
  try {
    const cached = await getItem('offline_user_session');
    if (cached && cached.user && cached.timestamp) {
      // Session cache is valid for 7 days
      const cacheAge = Date.now() - cached.timestamp;
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      if (cacheAge < maxAge) {
        return cached.user;
      }
    }
    return null;
  } catch (err) {
    console.error('Error getting cached user session:', err);
    return null;
  }
};