import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../utils/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import theme from '../../utils/theme';

const VerifyDashboard = () => {
  const { user, logout, refreshUserData } = useAuth();
  const [loading, setLoading] = useState(false);

  // Real-time listener for verification status
  useEffect(() => {
    if (!user?.uid) {
      console.log('⚠️ VerifyDashboard: No user UID available');
      return;
    }

    // Try multiple document ID possibilities
    const possibleIds = [
      user?.id,
      user?.studentId,
      user?.uid,
    ].filter(Boolean);

    if (possibleIds.length === 0) {
      console.log('⚠️ VerifyDashboard: Cannot set up listener, missing document ID');
      return;
    }

    console.log('👂 VerifyDashboard: Setting up real-time listener for:', possibleIds);
    
    // Set up listeners for all possible IDs
    const unsubscribes = [];
    
    for (const docId of possibleIds) {
      try {
        const userDocRef = doc(db, 'users', String(docId));
        
        const unsubscribe = onSnapshot(
          userDocRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const updatedData = snapshot.data();
              const newVerificationStatus = String(updatedData.verificationStatus || '').toLowerCase();
              const oldVerificationStatus = String(user?.verificationStatus || '').toLowerCase();

              console.log('🔄 VerifyDashboard: Status update detected:', {
                old: oldVerificationStatus,
                new: newVerificationStatus,
                docId: docId,
              });

              // If status changed to verified (from pending or any other state), refresh user data
              if (newVerificationStatus === 'verified' && oldVerificationStatus !== 'verified') {
                console.log('✅ VerifyDashboard: Account verified, refreshing user data...');
                setLoading(true);
                if (refreshUserData) {
                  refreshUserData()
                    .then(() => {
                      console.log('✅ VerifyDashboard: User data refreshed successfully');
                      setLoading(false);
                    })
                    .catch(err => {
                      console.error('❌ VerifyDashboard: Error refreshing user data after verification:', err);
                      setLoading(false);
                    });
                } else {
                  setLoading(false);
                }
              }
            } else {
              console.warn('⚠️ VerifyDashboard: Student document does not exist:', docId);
            }
          },
          (error) => {
            console.error('❌ VerifyDashboard: Error listening to verification updates:', error);
          }
        );
        
        unsubscribes.push(unsubscribe);
      } catch (err) {
        console.error(`❌ VerifyDashboard: Error setting up listener for ${docId}:`, err);
      }
    }

    return () => {
      console.log('🛑 VerifyDashboard: Cleaning up listeners');
      unsubscribes.forEach(unsub => {
        if (unsub) unsub();
      });
    };
  }, [user?.uid, user?.id, user?.studentId, user?.verificationStatus, refreshUserData]);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      setLoading(false);
    }
  };

  const studentName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.email || 'Student';

  return (
    <View style={styles.wrapper}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="hourglass-outline" size={48} color={theme.colors.primary} />
          </View>
          <Text style={styles.title}>Account Verification Pending</Text>
          <Text style={styles.subtitle}>
            Your account is waiting for admin approval
          </Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="person-outline" size={16} color={theme.colors.primary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Student Name</Text>
              <Text style={styles.infoValue}>{studentName}</Text>
            </View>
          </View>
          
          {user?.studentId && (
            <View style={styles.infoRow}>
              <View style={styles.iconWrap}>
                <Ionicons name="id-card-outline" size={16} color={theme.colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Student ID</Text>
                <Text style={styles.infoValue}>{user.studentId}</Text>
              </View>
            </View>
          )}
          
          {user?.email && (
            <View style={styles.infoRow}>
              <View style={styles.iconWrap}>
                <Ionicons name="mail-outline" size={16} color={theme.colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{user.email}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.messageCard}>
          <Text style={styles.messageText}>
            Your account registration has been received. An administrator will review your account and verify it shortly.
          </Text>
          <Text style={styles.messageText}>
            You will be automatically redirected to your dashboard once your account is verified.
          </Text>
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Checking verification status...</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.logoutButton, loading && styles.logoutButtonDisabled]}
          onPress={handleLogout}
          disabled={loading}
        >
          <Ionicons name="log-out-outline" size={16} color="#FFFFFF" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.md,
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: 'rgba(0,79,137,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.md,
    width: '100%',
    maxWidth: 400,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(0,79,137,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: theme.colors.muted,
    marginBottom: 2,
    fontWeight: theme.typography.weights.medium,
  },
  infoValue: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.weights.medium,
  },
  messageCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.md,
    width: '100%',
    maxWidth: 400,
  },
  messageText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  loadingText: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.muted,
  },
  logoutButton: {
    backgroundColor: '#8B0000',
    borderRadius: 8,
    padding: theme.spacing.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 0,
    ...theme.shadows.sm,
    width: '100%',
    maxWidth: 400,
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    marginLeft: theme.spacing.xs,
  },
});

export default VerifyDashboard;

