import React, { useContext, useEffect } from 'react';
import { View } from 'react-native';
import StudentTopHeader from '../screens/Student/StudentTopHeader';
import StudentTabNavigator from './StudentTabNavigator';
import { AuthContext } from '../contexts/AuthContext';
import VerifyDashboard from '../screens/Student/VerifyDashboard';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';

export default function StudentLayout() {
  const { user, refreshUserData } = useContext(AuthContext);

  const isStudent = String(user?.role || '').toLowerCase() === 'student';

  // Check verificationStatus: 'pending' means not verified, anything else (or missing) means verified
  const verificationStatus = String(user?.verificationStatus || '').toLowerCase();
  const shouldShowVerify = isStudent && verificationStatus === 'pending';

  // Real-time listener to refresh user data when verificationStatus changes
  useEffect(() => {
    if (!isStudent || !user?.uid) {
      return;
    }

    // Try multiple document ID possibilities
    const possibleIds = [
      user?.id,
      user?.studentId,
      user?.uid,
    ].filter(Boolean);

    if (possibleIds.length === 0) {
      console.log('⚠️ StudentLayout: Cannot set up verification listener: missing document ID');
      return;
    }

    console.log('👂 StudentLayout: Setting up real-time listener for student verification:', possibleIds);
    
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

              console.log('🔄 StudentLayout: Student verification status updated:', {
                old: oldVerificationStatus,
                new: newVerificationStatus,
                docId: docId,
              });

              // If status changed to verified (from pending or any other state), refresh user data
              if (newVerificationStatus === 'verified' && oldVerificationStatus !== 'verified') {
                console.log('✅ StudentLayout: Verification status changed, refreshing user data...');
                if (refreshUserData) {
                  refreshUserData()
                    .then(() => {
                      console.log('✅ StudentLayout: User data refreshed successfully');
                    })
                    .catch(err => {
                      console.error('❌ StudentLayout: Error refreshing user data after verification:', err);
                    });
                }
              }
            } else {
              console.warn('⚠️ StudentLayout: Student document does not exist:', docId);
            }
          },
          (error) => {
            console.error('❌ StudentLayout: Error listening to student verification updates:', error);
          }
        );
        
        unsubscribes.push(unsubscribe);
      } catch (err) {
        console.error(`❌ StudentLayout: Error setting up listener for ${docId}:`, err);
      }
    }

    return () => {
      console.log('🛑 StudentLayout: Cleaning up student verification listener');
      unsubscribes.forEach(unsub => {
        if (unsub) unsub();
      });
    };
  }, [isStudent, user?.uid, user?.id, user?.studentId, user?.verificationStatus, refreshUserData]);

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f9fc' }}>
      {shouldShowVerify ? (
        <VerifyDashboard />
      ) : (
        <>
          <StudentTopHeader />
          <View style={{ flex: 1 }}>
            <StudentTabNavigator />
          </View>
        </>
      )}
    </View>
  );
}

