import AsyncStorage from '@react-native-async-storage/async-storage';

// Set cache data with timestamp
export const setCacheData = async (key, data) => {
  try {
    const cacheEntry = {
      data,
      timestamp: new Date().toISOString(),
    };
    await AsyncStorage.setItem(`cache_${key}`, JSON.stringify(cacheEntry));
  } catch (error) {
    console.error(`Error setting cache for ${key}:`, error);
  }
};

// Get cache data
export const getCacheData = async (key) => {
  try {
    const cached = await AsyncStorage.getItem(`cache_${key}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      return parsed.data;
    }
    return null;
  } catch (error) {
    console.error(`Error getting cache for ${key}:`, error);
    return null;
  }
};

// Get cache timestamp
export const getCacheTimestamp = async (key) => {
  try {
    const cached = await AsyncStorage.getItem(`cache_${key}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      return parsed.timestamp;
    }
    return null;
  } catch (error) {
    console.error(`Error getting cache timestamp for ${key}:`, error);
    return null;
  }
};

// Clear cache data
export const clearCacheData = async (key) => {
  try {
    await AsyncStorage.removeItem(`cache_${key}`);
  } catch (error) {
    console.error(`Error clearing cache for ${key}:`, error);
  }
};

// Fetch with cache fallback
export const fetchWithCache = async (cacheKey, fetchFunction, options = {}) => {
  const { maxAge = 24 * 60 * 60 * 1000, useCache = true } = options; // Default 24 hours

  try {
    // Try to fetch fresh data
    const data = await fetchFunction();
    
    // Cache the fresh data
    if (useCache && data !== null && data !== undefined) {
      await setCacheData(cacheKey, data);
    }
    
    return { data, fromCache: false };
  } catch (error) {
    console.error(`Error fetching ${cacheKey}:`, error);
    
    // If online fetch fails, try to use cache
    if (useCache) {
      const cachedData = await getCacheData(cacheKey);
      const cacheTimestamp = await getCacheTimestamp(cacheKey);
      
      if (cachedData !== null && cacheTimestamp) {
        const age = new Date() - new Date(cacheTimestamp);
        
        // Return cached data if within max age
        if (age <= maxAge) {
          console.log(`Using cached data for ${cacheKey}`);
          return { data: cachedData, fromCache: true };
        }
      }
    }
    
    // Re-throw error if no cache available
    throw error;
  }
};

// Check if error is network-related
export const isNetworkError = (error) => {
  if (!error) return false;
  
  const errorCode = error?.code || '';
  const errorMessage = String(error?.message || '').toLowerCase();
  
  // Check for common network error codes
  const networkErrorCodes = [
    'unavailable',
    'network',
    'timeout',
    'connection',
    'fetch',
    'internet',
  ];
  
  const hasNetworkErrorCode = networkErrorCodes.some(code => 
    String(errorCode).toLowerCase().includes(code)
  );
  
  const hasNetworkErrorMessage = networkErrorMessages.some(msg => 
    errorMessage.includes(msg)
  );
  
  return hasNetworkErrorCode || hasNetworkErrorMessage;
};

// Common network error messages to check
const networkErrorMessages = [
  'network request failed',
  'networkerror',
  'failed to fetch',
  'connection',
  'timeout',
  'internet',
  'offline',
  'unavailable',
  'no connection',
];

