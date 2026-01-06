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
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="hourglass-outline" size={80} color="#F59E0B" />
        </View>
        <Text style={styles.title}>Account Verification Pending</Text>
        <Text style={styles.subtitle}>
          Your account is waiting for admin approval
        </Text>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={20} color="#6B7280" />
          <Text style={styles.infoLabel}>Student Name:</Text>
          <Text style={styles.infoValue}>{studentName}</Text>
        </View>
        
        {user?.studentId && (
          <View style={styles.infoRow}>
            <Ionicons name="id-card-outline" size={20} color="#6B7280" />
            <Text style={styles.infoLabel}>Student ID:</Text>
            <Text style={styles.infoValue}>{user.studentId}</Text>
          </View>
        )}
        
        {user?.email && (
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color="#6B7280" />
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{user.email}</Text>
          </View>
        )}
      </View>

      <View style={styles.messageCard}>
        <Ionicons name="information-circle-outline" size={24} color="#3B82F6" />
        <Text style={styles.messageText}>
          Your account registration has been received. An administrator will review your account and verify it shortly.
        </Text>
        <Text style={styles.messageText}>
          You will be automatically redirected to your dashboard once your account is verified.
        </Text>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Checking verification status...</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        disabled={loading}
      >
        <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fc',
  },
  contentContainer: {
    padding: 20,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
    marginRight: 8,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
  },
  messageCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  messageText: {
    fontSize: 14,
    color: '#1E40AF',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
    marginBottom: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  logoutButton: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default VerifyDashboard;

