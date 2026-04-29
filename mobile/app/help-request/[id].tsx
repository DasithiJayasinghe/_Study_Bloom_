import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { helpRequestService } from '../../services/helpRequestService';
import { HelpRequest } from '../../services/helpRequestTypes';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
  primary: '#D81B60',
  secondary: '#9C27B0',
  background: '#F3E5F5',
  white: '#FFFFFF',
  text: '#211826',
  muted: '#7A6A78',
  urgentBg: '#FFE5EB',
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5000/api';
const BASE_URL = API_URL.replace('/api', '');

function buildAttachmentUrl(path: string) {
  if (path.startsWith('http')) return path;
  return `${BASE_URL}${path}`;
}

export default function HelpRequestDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [request, setRequest] = useState<HelpRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  const loadRequest = useCallback(async () => {
    if (!id) return;

    try {
      const data = await helpRequestService.getHelpRequestById(id);
      setRequest(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load request details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadRequest();
    }, [loadRequest])
  );

  const canMessage = useMemo(() => {
    if (!request) return false;
    return request.status === 'accepted' || !!request.acceptedBy;
  }, [request]);

  const handleAccept = async () => {
    if (!request) return;

    try {
      setAccepting(true);
      await helpRequestService.acceptHelpRequest(request._id);
      await loadRequest();
      Alert.alert('Success', 'Request accepted successfully');
    } catch (error: any) {
      Alert.alert('Accept Error', error.message || 'Failed to accept request');
    } finally {
      setAccepting(false);
    }
  };

  const handleMessageUser = () => {
    if (!canMessage) return;
    Alert.alert('Open Chat', 'Chat screen is made by Ruhansi, please check with her to implement this feature.');
  };

  const handleOpenAttachment = async (path: string) => {
    try {
      const url = buildAttachmentUrl(path);
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        Alert.alert('Error', 'Cannot open this attachment');
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Error', 'Failed to open attachment');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!request) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerBox}>
          <Text style={styles.emptyText}>Request not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const requesterName =
    typeof request.user === 'object' ? request.user.fullName : 'Anonymous';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Request Details</Text>

          {request.isUrgent ? (
            <View style={styles.urgentBadge}>
              <Text style={styles.urgentBadgeText}>URGENT</Text>
            </View>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.requestedLabel}>REQUESTED BY</Text>
          <Text style={styles.requestedName}>{requesterName}</Text>

          <View style={styles.subjectChip}>
            <Text style={styles.subjectChipText}>{request.subject}</Text>
          </View>

          <Text style={styles.title}>{request.questionTitle}</Text>
          <Text style={styles.description}>{request.questionDetails}</Text>

          {request.attachments && request.attachments.length > 0 ? (
            <>
              <Text style={styles.attachmentsTitle}>Attached Files</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {request.attachments.map((file, index) => {
                  const fileUrl = buildAttachmentUrl(file);
                  const isImage =
                    file.toLowerCase().endsWith('.png') ||
                    file.toLowerCase().endsWith('.jpg') ||
                    file.toLowerCase().endsWith('.jpeg') ||
                    file.toLowerCase().endsWith('.webp');

                  return (
                    <TouchableOpacity
                      key={`${file}-${index}`}
                      style={styles.attachmentCard}
                      onPress={() => handleOpenAttachment(file)}
                    >
                      {isImage ? (
                        <Image source={{ uri: fileUrl }} style={styles.attachmentImage} />
                      ) : (
                        <View style={styles.filePlaceholder}>
                          <Ionicons
                            name="document-text-outline"
                            size={34}
                            color={COLORS.primary}
                          />
                          <Text style={styles.filePlaceholderText}>Open File</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.acceptBtn}
          activeOpacity={0.9}
          onPress={handleAccept}
          disabled={accepting || request.status === 'accepted'}
        >
          <Text style={styles.acceptBtnText}>
            {request.status === 'accepted'
              ? 'Accepted'
              : accepting
              ? 'Accepting...'
              : 'Accept Request'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.messageBtn, !canMessage && styles.disabledBtn]}
          activeOpacity={0.9}
          onPress={handleMessageUser}
          disabled={!canMessage}
        >
          <Text style={[styles.messageBtnText, !canMessage && styles.disabledText]}>
            Message User
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F7EDF7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  headerSpacer: {
    width: 42,
  },
  urgentBadge: {
    backgroundColor: COLORS.urgentBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  urgentBadgeText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 28,
    padding: 20,
    marginBottom: 20,
  },
  requestedLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.muted,
    letterSpacing: 1.4,
  },
  requestedName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 4,
    marginBottom: 14,
  },
  subjectChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#F2D9F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 14,
  },
  subjectChipText: {
    color: COLORS.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    lineHeight: 34,
    marginBottom: 14,
  },
  description: {
    fontSize: 16,
    lineHeight: 26,
    color: COLORS.muted,
  },
  attachmentsTitle: {
    marginTop: 20,
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  attachmentCard: {
    marginRight: 12,
  },
  attachmentImage: {
    width: 140,
    height: 100,
    borderRadius: 18,
  },
  filePlaceholder: {
    width: 140,
    height: 100,
    borderRadius: 18,
    backgroundColor: '#F7EDF7',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  filePlaceholderText: {
    marginTop: 8,
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  acceptBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 28,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  acceptBtnText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '800',
  },
  messageBtn: {
    backgroundColor: '#F2D9F3',
    borderRadius: 28,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  messageBtnText: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  disabledText: {
    color: '#8D7A8A',
  },
  cancelBtn: {
    borderRadius: 28,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2C3D0',
  },
  cancelBtnText: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
  },
});