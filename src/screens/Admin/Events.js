import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { AuthContext } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, getDocs, orderBy, addDoc, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../utils/firebaseConfig';
import { fetchWithCache, isNetworkError } from '../../utils/offlineCache';
import OfflineBanner from '../../components/OfflineBanner';
import NetInfo from '@react-native-community/netinfo';

const { height } = Dimensions.get('window');

const Events = () => {
  const { user } = useContext(AuthContext);
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Card visual palette (matches admin dashboard card styling)
  const adminCardPalette = {
    cardBg: '#FFFFFF',
    borderColor: '#E5E7EB',
    iconBg: 'rgba(0,79,137,0.12)',
    accentColor: '#004f89',
    badgeBg: '#004f89',
    badgeTextColor: '#FFFFFF',
    textColor: '#004f89',
    labelColor: '#004f89',
  };

  // Categories for filtering
  const categories = [
    { id: 'all', name: 'All', icon: 'apps-outline' },
    { id: 'general', name: 'General', icon: 'information-circle-outline' },
    { id: 'academic', name: 'Academic', icon: 'school-outline' },
    { id: 'sports', name: 'Sports', icon: 'football-outline' },
    { id: 'events', name: 'Events', icon: 'calendar-outline' },
    { id: 'emergency', name: 'Emergency', icon: 'warning-outline' },
  ];

  // Create announcement states
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    message: '',
    category: 'general',
    author: user?.firstName || 'Admin'
  });
  const [creating, setCreating] = useState(false);
  
  // Feedback modal states
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState(true);
  
  // Delete confirmation modal states
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState(null);

  // Create confirmation modal states
  const [createConfirmVisible, setCreateConfirmVisible] = useState(false);
  const [creatingConfirm, setCreatingConfirm] = useState(false);

  // Network monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected;
      setIsOnline(connected);
      setShowOfflineBanner(!connected);
    });

    // Check initial network state
    NetInfo.fetch().then(state => {
      const connected = state.isConnected;
      setIsOnline(connected);
      setShowOfflineBanner(!connected);
    });

    return () => unsubscribe();
  }, []);

  // Update author when user changes
  useEffect(() => {
    if (user?.firstName) {
      setNewAnnouncement(prev => ({ ...prev, author: user.firstName }));
    }
  }, [user?.firstName]);

  // Load announcements from Firebase
  const loadAnnouncements = async () => {
    setAnnouncementsLoading(true);
    try {
      const { data, fromCache } = await fetchWithCache('admin_events_announcements', async () => {
        const announcementsRef = collection(db, 'announcements');
        const announcementsQuery = query(announcementsRef, orderBy('createdAt', 'desc'));
        const announcementsSnap = await getDocs(announcementsQuery);
        
        const announcementsData = [];
        announcementsSnap.forEach((doc) => {
          const data = doc.data();
          announcementsData.push({
            id: doc.id,
            title: data.title || 'Announcement',
            message: data.message || '',
            category: data.category || 'general',
            createdAt: data.createdAt || new Date().toISOString(),
            priority: data.priority || 'normal',
            author: data.author || 'Admin',
            pinned: data.pinned || false,
            ...data
          });
        });
        
        return announcementsData;
      });

      // Sort announcements: pinned first, then by creation date
      const sortedData = [...(data || [])];
      sortedData.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      
      setAnnouncements(sortedData);

      // Show offline banner if data loaded from cache
      if (fromCache) {
        setShowOfflineBanner(true);
      }
    } catch (error) {
      console.log('Error loading announcements:', error);
      if (isNetworkError(error)) {
        setShowOfflineBanner(true);
      }
      setAnnouncements([]);
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) loadAnnouncements();
  }, [isFocused]);

  // Create announcement functions
  const openCreateModal = () => {
    setCreateModalVisible(true);
    setNewAnnouncement({
      title: '',
      message: '',
      category: 'general',
      author: user?.firstName || 'Admin'
    });
  };

  const closeCreateModal = () => {
    setCreateModalVisible(false);
    setNewAnnouncement({
      title: '',
      message: '',
      category: 'general',
      author: user?.firstName || 'Admin'
    });
  };

  const createAnnouncement = async () => {
    // Check if offline
    if (!isOnline) {
      setFeedbackMessage('Cannot create announcement while offline. Please check your internet connection.');
      setFeedbackSuccess(false);
      setFeedbackVisible(true);
      setTimeout(() => setFeedbackVisible(false), 3000);
      setCreateConfirmVisible(false);
      return;
    }

    if (!newAnnouncement.title.trim() || !newAnnouncement.message.trim()) {
      setFeedbackMessage('Please fill in both title and message');
      setFeedbackSuccess(false);
      setFeedbackVisible(true);
      setTimeout(() => setFeedbackVisible(false), 3000);
      return;
    }

    if (creatingConfirm) return;
    setCreatingConfirm(true);
    setCreateConfirmVisible(false);
    
    try {
      const announcementData = {
        title: newAnnouncement.title.trim(),
        message: newAnnouncement.message.trim(),
        category: newAnnouncement.category,
        priority: 'normal',
        author: newAnnouncement.author,
        createdAt: new Date().toISOString(),
        createdBy: user?.uid || user?.adminId || 'admin'
      };

      await addDoc(collection(db, 'announcements'), announcementData);
      
      setFeedbackMessage('Announcement created successfully!');
      setFeedbackSuccess(true);
      setFeedbackVisible(true);
      setTimeout(() => setFeedbackVisible(false), 3000);
      
      closeCreateModal();
      loadAnnouncements();
    } catch (error) {
      console.log('Error creating announcement:', error);
      setFeedbackMessage('Failed to create announcement. Please try again.');
      setFeedbackSuccess(false);
      setFeedbackVisible(true);
      setTimeout(() => setFeedbackVisible(false), 3000);
    } finally {
      setCreatingConfirm(false);
    }
  };

  // Delete announcement function
  const deleteAnnouncement = async () => {
    if (!announcementToDelete) return;

    // Check if offline
    if (!isOnline) {
      setFeedbackMessage('Cannot delete announcement while offline. Please check your internet connection.');
      setFeedbackSuccess(false);
      setFeedbackVisible(true);
      setTimeout(() => setFeedbackVisible(false), 3000);
      setDeleteConfirmVisible(false);
      return;
    }
    
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'announcements', announcementToDelete.id));
      
      setFeedbackMessage('Announcement deleted successfully');
      setFeedbackSuccess(true);
      setFeedbackVisible(true);
      setTimeout(() => setFeedbackVisible(false), 1500);
      
      setDeleteConfirmVisible(false);
      setAnnouncementToDelete(null);
      loadAnnouncements();
    } catch (error) {
      console.log('Error deleting announcement:', error);
      setFeedbackMessage('Failed to delete announcement');
      setFeedbackSuccess(false);
      setFeedbackVisible(true);
      setTimeout(() => setFeedbackVisible(false), 2000);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle delete button press
  const handleDeletePress = (announcement) => {
    if (!isOnline) {
      setFeedbackMessage('Cannot delete announcement while offline. Please check your internet connection.');
      setFeedbackSuccess(false);
      setFeedbackVisible(true);
      setTimeout(() => setFeedbackVisible(false), 3000);
      return;
    }
    setAnnouncementToDelete(announcement);
    setDeleteConfirmVisible(true);
  };

  // Handle pin button press
  const handlePinPress = async (announcement) => {
    // Check if offline
    if (!isOnline) {
      setFeedbackMessage('Cannot update pin status while offline. Please check your internet connection.');
      setFeedbackSuccess(false);
      setFeedbackVisible(true);
      setTimeout(() => setFeedbackVisible(false), 3000);
      return;
    }

    try {
      const newPinnedState = !announcement.pinned;
      
      await updateDoc(doc(db, 'announcements', announcement.id), {
        pinned: newPinnedState
      });
      
      loadAnnouncements();
    } catch (error) {
      console.log('Error updating pin status:', error);
      setFeedbackMessage('Failed to update pin status. Please check your internet connection.');
      setFeedbackSuccess(false);
      setFeedbackVisible(true);
      setTimeout(() => setFeedbackVisible(false), 3000);
    }
  };

  // Filter announcements based on selected category
  const filteredAnnouncements = announcements.filter(announcement => {
    if (selectedCategory === 'all') return true;
    return announcement.category === selectedCategory;
  });

  // Get category icon and color
  const getCategoryInfo = (category) => {
    const categoryData = categories.find(cat => cat.id === category);
    if (!categoryData) return { icon: 'information-circle-outline', color: '#2563EB', bgColor: '#EFF6FF' };
    
    const colors = {
      general: { color: '#2563EB', bgColor: '#EFF6FF' },
      academic: { color: '#16A34A', bgColor: '#F0FDF4' },
      sports: { color: '#D97706', bgColor: '#FEF3C7' },
      events: { color: '#DC2626', bgColor: '#FEE2E2' },
      emergency: { color: '#7C3AED', bgColor: '#F3E8FF' },
    };
    
    const colorInfo = colors[category] || colors.general;
    return {
      icon: categoryData.icon,
      color: colorInfo.color,
      bgColor: colorInfo.bgColor
    };
  };

  // Format date
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Unknown date';
    }
  };

  return (
    <>
      <View style={styles.wrapper}>
        {/* Content */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Category Selection - 3x2 Grid */}
          <View style={styles.section}>
            <View style={styles.categoryGrid}>
              {categories.map((category) => {
                const isSelected = selectedCategory === category.id;
                
                return (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryCard,
                      {
                        backgroundColor: isSelected ? '#EFF6FF' : adminCardPalette.cardBg,
                        borderColor: isSelected ? '#004f89' : adminCardPalette.borderColor,
                      }
                    ]}
                    onPress={() => setSelectedCategory(category.id)}
                  >
                    <View style={styles.categoryCardContent}>
                      <View style={[
                        styles.categoryCardIconWrap,
                        { backgroundColor: adminCardPalette.iconBg }
                      ]}>
                        <Ionicons 
                          name={category.icon} 
                          size={20} 
                          color={adminCardPalette.accentColor} 
                        />
                      </View>
                      <Text style={[
                        styles.categoryCardLabel,
                        { color: adminCardPalette.labelColor }
                      ]}>
                        {category.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Announcements List */}
          <View style={styles.announcementsSection}>
            <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Announcements</Text>
            {announcementsLoading ? (
                <View style={{ flex: 1, backgroundColor: '#FFFFFF', minHeight: 200 }} />
              ) : filteredAnnouncements.length === 0 ? (
                <View style={styles.centerContainer}>
                  <View style={styles.emptyCard}>
                    <View style={styles.emptyIconWrap}>
                      <Ionicons name="megaphone-outline" size={28} color="#2563EB" />
                      <View style={styles.emptyIconSlash} />
                    </View>
                    <Text style={styles.emptyTitle}>No Announcements</Text>
                    <Text style={styles.emptySubtext}>
                      {selectedCategory === 'all' 
                        ? 'No announcements have been posted yet.' 
                        : `No ${categories.find(cat => cat.id === selectedCategory)?.name.toLowerCase()} announcements found.`
                      }
                    </Text>
                  </View>
                </View>
              ) : (
                filteredAnnouncements.map((announcement) => {
                  const categoryInfo = getCategoryInfo(announcement.category);
                  
                  return (
                    <View
                      key={announcement.id}
                      style={styles.announcementCard}
                    >
                      <View style={styles.announcementHeader}>
                        <View style={styles.announcementTitleRow}>
                          <View style={[styles.categoryBadge, { backgroundColor: 'rgba(0,79,137,0.12)' }]}>
                            <Ionicons name={categoryInfo.icon} size={14} color="#004f89" />
                            <Text style={[styles.categoryBadgeText, { color: '#004f89' }]}>
                              {categories.find(cat => cat.id === announcement.category)?.name || 'General'}
                            </Text>
                          </View>
                          <View style={styles.badgeContainer}>
                            {announcement.priority === 'high' && (
                              <View style={styles.priorityBadge}>
                                <Ionicons name="warning" size={12} color="#DC2626" />
                                <Text style={styles.priorityText}>High Priority</Text>
                              </View>
                            )}
                            <TouchableOpacity 
                              style={[
                                styles.actionBadge,
                                announcement.pinned && styles.actionBadgePinned
                              ]}
                              onPress={() => handlePinPress(announcement)}
                            >
                              <Ionicons 
                                name={announcement.pinned ? "pin" : "pin-outline"} 
                                size={20} 
                                color={announcement.pinned ? "#FFFFFF" : "#004f89"} 
                              />
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={styles.actionBadge}
                              onPress={() => handleDeletePress(announcement)}
                            >
                              <Ionicons name="trash-outline" size={20} color="#004f89" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                      
                      <View style={styles.announcementContent}>
                        <Text selectable style={styles.announcementTitle}>Title: {announcement.title}</Text>
                        <Text selectable style={styles.announcementMessage}>
                          {announcement.message}
                        </Text>
                      </View>
                      
                      <View style={styles.announcementFooter}>
                        <View style={{ flex: 1 }} />
                        <Text style={styles.announcementDate}>{formatDate(announcement.createdAt)}</Text>
                      </View>
                    </View>
                  );
                })
              )}
          </View>
        </ScrollView>
        
        {/* Plus menu button (floating action button) */}
        <TouchableOpacity 
          style={styles.menuFab}
          onPress={openCreateModal}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <OfflineBanner visible={showOfflineBanner} />
      </View>

      {/* Create Announcement Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={createModalVisible}
        onRequestClose={closeCreateModal}
      >
        <View style={styles.modernModalOverlay}>
          <View style={styles.modernModalCard}>
            <View style={styles.modernModalHeader}>
              <View style={[styles.modernHeaderGradient, { backgroundColor: '#004f89' }]}>
                <View style={styles.modernHeaderContent}>
                  <View style={styles.modernAvatar}>
                    <View style={styles.avatarOctagonMedium} />
                    <Ionicons 
                      name="add-circle-outline" 
                      size={24} 
                      color="#FFFFFF" 
                    />
                  </View>
                  <View style={styles.modernHeaderInfo}>
                    <Text style={styles.modernName}>Create Announcement</Text>
                    <Text style={styles.modernId}>Add a new announcement</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  onPress={() => { 
                    if (!creating && !creatingConfirm) {
                      closeCreateModal(); 
                    }
                  }} 
                  style={styles.modernCloseBtn}
                  disabled={creating || creatingConfirm}
                >
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
            
            <ScrollView style={styles.createModalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Title</Text>
                <TextInput
                  style={styles.textInput}
                  value={newAnnouncement.title}
                  onChangeText={(text) => setNewAnnouncement(prev => ({ ...prev, title: text }))}
                  placeholder="Enter announcement title"
                  placeholderTextColor="#9CA3AF"
                  maxLength={100}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Message</Text>
                <TextInput
                  style={[styles.textInput, styles.messageInput]}
                  value={newAnnouncement.message}
                  onChangeText={(text) => setNewAnnouncement(prev => ({ ...prev, message: text }))}
                  placeholder="Enter announcement message"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={500}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category</Text>
                <View style={styles.categorySelector}>
                  {categories.filter(cat => cat.id !== 'all').map((category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categoryOption,
                        newAnnouncement.category === category.id && styles.categoryOptionSelected
                      ]}
                      onPress={() => setNewAnnouncement(prev => ({ ...prev, category: category.id }))}
                    >
                      <Ionicons 
                        name={category.icon} 
                        size={16} 
                        color={newAnnouncement.category === category.id ? '#2563EB' : '#6B7280'} 
                      />
                      <Text style={[
                        styles.categoryOptionText,
                        newAnnouncement.category === category.id && styles.categoryOptionTextSelected
                      ]}>
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modernActions}>
              <TouchableOpacity 
                style={styles.modernCloseButton} 
                onPress={() => { 
                  if (!creating && !creatingConfirm) {
                    closeCreateModal(); 
                  }
                }}
                disabled={creating || creatingConfirm}
              >
                <Text style={styles.modernCloseButtonText}>Close</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.modernSaveButton,
                  (creating || creatingConfirm || !newAnnouncement.title.trim() || !newAnnouncement.message.trim()) && styles.modernActionButtonDisabled
                ]} 
                onPress={() => {
                  if (!creating && !creatingConfirm && newAnnouncement.title.trim() && newAnnouncement.message.trim()) {
                    setCreateConfirmVisible(true);
                  }
                }}
                disabled={creating || creatingConfirm || !newAnnouncement.title.trim() || !newAnnouncement.message.trim()}
              >
                <Text style={[
                  styles.modernSaveButtonText,
                  (creating || creatingConfirm || !newAnnouncement.title.trim() || !newAnnouncement.message.trim()) && styles.modernDisabledButtonText
                ]}>
                  Create
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Confirmation Modal */}
      <Modal transparent animationType="fade" visible={createConfirmVisible} onRequestClose={() => !creatingConfirm && setCreateConfirmVisible(false)}>
        <View style={styles.modalOverlayCenter}>
          <View style={styles.fbModalCard}>
            <ScrollView 
              style={styles.fbModalScrollContent}
              contentContainerStyle={styles.fbModalContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.fbModalTitle}>Create announcement?</Text>
              <Text style={styles.fbModalMessage}>Are you sure you want to create this announcement?</Text>
            </ScrollView>
            <View style={styles.fbModalButtonContainer}>
              <TouchableOpacity 
                style={[styles.fbModalCancelButton, creatingConfirm && styles.fbModalButtonDisabled]} 
                onPress={() => !creatingConfirm && setCreateConfirmVisible(false)}
                disabled={creatingConfirm}
              >
                <Text style={styles.fbModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.fbModalConfirmButton, 
                  { backgroundColor: '#004f89' },
                  creatingConfirm && styles.fbModalButtonDisabled
                ]} 
                onPress={async () => {
                  // Check network before creating
                  const state = await NetInfo.fetch();
                  if (!state.isConnected) {
                    setCreateConfirmVisible(false);
                    setFeedbackMessage('Cannot create announcement while offline. Please check your internet connection.');
                    setFeedbackSuccess(false);
                    setFeedbackVisible(true);
                    setTimeout(() => setFeedbackVisible(false), 3000);
                    return;
                  }
                  createAnnouncement();
                }}
                disabled={creatingConfirm}
              >
                <Text style={styles.fbModalConfirmText}>{creatingConfirm ? 'Creating...' : 'Confirm'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={deleteConfirmVisible}
        onRequestClose={() => !isDeleting && setDeleteConfirmVisible(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={styles.fbModalCard}>
            <ScrollView 
              style={styles.fbModalScrollContent}
              contentContainerStyle={styles.fbModalContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.fbModalTitle}>Delete announcement?</Text>
              <Text style={styles.fbModalMessage}>Are you sure you want to delete this announcement?</Text>
            </ScrollView>
            <View style={styles.fbModalButtonContainer}>
              <TouchableOpacity 
                style={[styles.fbModalCancelButton, isDeleting && styles.fbModalButtonDisabled]} 
                onPress={() => !isDeleting && setDeleteConfirmVisible(false)}
                disabled={isDeleting}
              >
                <Text style={styles.fbModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.fbModalConfirmButton, 
                  { backgroundColor: '#DC2626' },
                  isDeleting && styles.fbModalButtonDisabled
                ]} 
                onPress={deleteAnnouncement}
                disabled={isDeleting}
              >
                <Text style={styles.fbModalConfirmText}>{isDeleting ? 'Deleting...' : 'Delete'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Feedback Modal */}
      <Modal transparent animationType="fade" visible={feedbackVisible} onRequestClose={() => setFeedbackVisible(false)}>
        <View style={styles.modalOverlayCenter}>
          <View style={styles.fbModalCard}>
            <ScrollView 
              style={styles.fbModalScrollContent}
              contentContainerStyle={styles.fbModalContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.fbModalTitle, { 
                color: feedbackMessage?.toLowerCase().includes('offline') ? '#8B0000' : (feedbackSuccess ? '#10B981' : '#DC2626')
              }]}>
                {feedbackMessage?.toLowerCase().includes('offline') ? 'No internet Connection' : (feedbackSuccess ? 'Success' : 'Notice')}
              </Text>
              <Text style={styles.fbModalMessage}>{feedbackMessage}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollView: { flex: 1 },
  scrollContent: { 
    padding: 16, 
    paddingBottom: 120, 
    paddingTop: 16, 
  },
  
  // Section (matches dashboard)
  section: { marginBottom: 4 },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0078cf',
    marginRight: 8,
    marginBottom: 5,
    marginTop: 10,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 0,
    marginBottom: 0,
  },
  categoryCard: {
    width: '31.5%',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 0,
    marginBottom: 6,
    minHeight: 80,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 2,
  },
  categoryCardContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  categoryCardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  categoryCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#004f89',
    textAlign: 'center',
  },
  
  // Announcements Section
  announcementsSection: {
    paddingTop: 0,
    flex: 1,
    minHeight: 400,
  },
  
  // Announcement Cards
  announcementCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  announcementHeader: {
    marginBottom: 8,
  },
  announcementTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  priorityText: {
    fontSize: 10,
    color: '#DC2626',
    fontWeight: '600',
  },
  announcementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  announcementContent: {
    marginBottom: 8,
  },
  announcementMessage: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  announcementFooter: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  announcementDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  
  // Empty State (mirrored from Admin Alerts)
  centerContainer: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 0,
    minHeight: 300,
  },
  emptyCard: { 
    backgroundColor: '#fff', 
    borderRadius: 8, 
    padding: 16, 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#E5E7EB', 
    shadowColor: '#0F172A', 
    shadowOpacity: 0.08, 
    shadowOffset: { width: 0, height: 6 }, 
    shadowRadius: 12, 
    elevation: 4, 
    width: '100%' 
  },
  emptyIconWrap: { 
    width: 40, 
    height: 40, 
    borderRadius: 8, 
    backgroundColor: '#EFF6FF', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 8,
    position: 'relative',
  },
  emptyIconSlash: {
    position: 'absolute',
    width: 2,
    height: 32,
    backgroundColor: '#2563EB',
    transform: [{ rotate: '-45deg' }],
    borderRadius: 1,
  },
  emptyTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#111827', 
    marginTop: 0, 
    marginBottom: 4 
  },
  emptySubtext: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 12,
  },
  
  // Badge styles
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(0,79,137,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBadgePinned: {
    backgroundColor: '#004f89',
  },
  
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '85%', maxWidth: 400, alignItems: 'center' },
  modalIconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 8 },
  modalText: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalButton: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center' },
  modalButtonText: { fontSize: 16, fontWeight: '600', color: '#6B7280' },
  modalButtonDanger: { backgroundColor: '#FEE2E2' },
  modalButtonDangerText: { color: '#b91c1c' },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonTextDisabled: {
    opacity: 0.5,
  },
  
  // Create Modal Styles
  createModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 12,
  },
  createModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  createModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createModalContent: {
    padding: 20,
    maxHeight: 400,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  messageInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  categorySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  categoryOptionSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  categoryOptionText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  categoryOptionTextSelected: {
    color: '#2563EB',
    fontWeight: '600',
  },
  createModalActions: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  createSubmitButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  createSubmitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  createSubmitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // 3-dot menu button (FAB)
  menuFab: { 
    position: 'absolute', 
    bottom: 20, 
    right: 20, 
    width: 60, 
    height: 60, 
    borderRadius: 15, 
    backgroundColor: '#004f89', 
    justifyContent: 'center', 
    alignItems: 'center', 
    shadowColor: '#000', 
    shadowOpacity: 0.2, 
    shadowOffset: { width: 0, height: 4 }, 
    shadowRadius: 5, 
    elevation: 8 
  },
  
  // Modern modal styles (matching Schedule.js)
  modernModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modernModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 32,
    elevation: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  modernModalHeader: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    overflow: 'hidden',
  },
  modernHeaderGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: '#004f89',
    position: 'relative',
  },
  modernHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modernAvatar: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  avatarOctagonMedium: { 
    position: 'absolute', 
    width: 44, 
    height: 44, 
    backgroundColor: 'rgba(255,255,255,0.18)', 
    borderWidth: 2, 
    borderColor: 'rgba(255,255,255,0.35)', 
    borderRadius: 10 
  },
  modernHeaderInfo: {
    flex: 1,
  },
  modernName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  modernId: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  modernCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernActions: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  modernCloseButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  modernSaveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#004f89',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  modernSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modernActionButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.6,
  },
  modernDisabledButtonText: {
    color: '#FFFFFF',
    opacity: 0.8,
  },
  
  // Facebook-style modal styles (matching Schedule.js)
  modalOverlayCenter: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  fbModalCard: {
    width: '85%',
    maxWidth: 400,
    maxHeight: height * 0.85,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 5,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  fbModalScrollContent: {
    flexGrow: 0,
  },
  fbModalContent: {
    flexGrow: 0,
  },
  fbModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#050505',
    marginBottom: 12,
    textAlign: 'left',
  },
  fbModalMessage: {
    fontSize: 15,
    color: '#65676B',
    textAlign: 'left',
    lineHeight: 20,
  },
  fbModalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 8,
  },
  fbModalCancelButton: {
    backgroundColor: '#E4E6EB',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fbModalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#050505',
  },
  fbModalConfirmButton: {
    backgroundColor: '#1877F2',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fbModalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  fbModalButtonDisabled: {
    opacity: 0.5,
  },
});

export default Events;
