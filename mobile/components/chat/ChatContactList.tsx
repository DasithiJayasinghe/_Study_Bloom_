import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, SafeAreaView, useColorScheme, Platform, StatusBar } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { chatService } from '@/services/chatService';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, StudyBloomColors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface ChatContactsListProps {
    role: 'requester' | 'responder';
    title: string;
}

export default function ChatContactsList({ role, title }: ChatContactsListProps) {
    const [contacts, setContacts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const router = useRouter();
    const colorScheme = useColorScheme() ?? 'light';
    const isDark = colorScheme === 'dark';

    const fetchContacts = useCallback(async () => {
        try {
            setLoading(true);
            const data = await chatService.getContacts(role);
            setContacts(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [role]);

    useFocusEffect(
        useCallback(() => {
            fetchContacts();
        }, [fetchContacts])
    );

    const getOtherUser = (room: any) => {
        if (!user) return null;
        const currentUserId = (user.id || user._id || '').toString();
        const requesterId = (room.requester?._id || '').toString();
        return requesterId === currentUserId ? room.responder : room.requester;
    };

    const formatTime = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();

        // If today, show time
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        // If within last week, show day name
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 7) {
            return date.toLocaleDateString([], { weekday: 'short' });
        }

        // Otherwise show date
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return { label: 'Pending', bgColor: '#F8BBD0', color: '#D81B60' };
            case 'active':
                return { label: 'Active', bgColor: '#EC407A', color: '#FFF' };
            case 'complete':
            case 'resolved':
            case 'Resolved':
                return { label: 'Resolved', bgColor: '#7E57C2', color: '#FFF' };
            default:
                return { label: status, bgColor: '#E0E0E0', color: '#666' };
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        const otherUser = getOtherUser(item);
        if (!otherUser) return null;

        // Use actual status from item, handle case sensitivity
        const status = item.status || 'pending';
        const badge = getStatusBadge(status);

        return (
            <TouchableOpacity
                style={[styles.contactCard, { backgroundColor: isDark ? Colors.dark.card : '#FFFFFF' }]}
                onPress={() => router.push(`/chat/${item._id}`)}
                activeOpacity={0.7}
            >
                <View style={styles.avatarContainer}>
                    <View style={styles.avatar}>
                        <Ionicons name="person-circle" size={60} color="#D81B60" />
                    </View>
                    {status === 'active' && <View style={styles.onlineIndicator} />}
                </View>

                <View style={styles.contactInfo}>
                    <View style={styles.nameRow}>
                        <Text style={[styles.contactName, { color: isDark ? Colors.dark.text : '#2D3436' }]} numberOfLines={1}>
                            {otherUser.fullName || ''}
                        </Text>
                        <Text style={styles.timeText}>{formatTime(item.updatedAt)}</Text>
                    </View>

                    <View style={styles.messageRow}>
                        <Text style={[styles.snippet, { color: isDark ? Colors.dark.textSecondary : '#636E72' }]} numberOfLines={1}>
                            {item.concern?.title || item.lastMessage || "Starting a new conversation..."}
                        </Text>
                        <View style={[styles.badgeContainer, { backgroundColor: badge.bgColor }]}>
                            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    // Force light theme colors as per user request
    const bgColor = '#FDF2F8'; // Light pink background
    const cardBg = '#FFFFFF';
    const primaryColor = '#D81B60'; // Magenta
    const secondaryColor = '#9C27B0'; // Purple

    return (
        <View style={[styles.container, { backgroundColor: bgColor }]}>
            <StatusBar barStyle="dark-content" />
            <LinearGradient colors={[primaryColor, '#FF6B95']} style={styles.headerGradient}>
                <SafeAreaView>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>{title}</Text>
                        {role === 'requester' ? (
                            <TouchableOpacity
                                style={styles.feedTag}
                                onPress={() => router.push('/(tabs)/help-feed')}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="people-outline" size={14} color={primaryColor} />
                                <Text style={styles.feedTagText}>Help Feed</Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={{ width: 40 }} />
                        )}
                    </View>
                </SafeAreaView>
            </LinearGradient>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={primaryColor} />
                </View>
            ) : (
                <FlatList
                    data={contacts}
                    keyExtractor={(item) => item._id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="chatbubbles-outline" size={64} color={primaryColor + '50'} />
                            <Text style={[styles.emptyText, { color: '#666' }]}>
                                {role === 'requester' ? 'No help requests made yet.' : 'No active responses yet.'}
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerGradient: {
        paddingBottom: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 20,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#FFF',
        letterSpacing: -0.5,
    },
    feedTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 4,
    },
    feedTagText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#D81B60',
    },
    contactCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginHorizontal: 16,
        marginVertical: 8,
        borderRadius: 20,
        backgroundColor: '#FFF',
        ...Platform.select({
            ios: {
                shadowColor: '#D81B60',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
            },
            android: {
                elevation: 3,
            },
            web: {
                boxShadow: '0 4px 12px rgba(216, 27, 96, 0.08)',
            }
        }),
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 16,
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#F0F0F0',
        borderWidth: 2,
        borderColor: '#FDF2F8',
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#4CAF50',
        borderWidth: 2,
        borderColor: '#FFF',
    },
    contactInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    nameRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    contactName: {
        fontSize: 17,
        fontWeight: '700',
        color: '#333',
        flex: 1,
        marginRight: 8,
    },
    timeText: {
        fontSize: 12,
        color: '#999',
        fontWeight: '500',
    },
    messageRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    snippet: {
        fontSize: 14,
        lineHeight: 20,
        color: '#777',
        flex: 1,
        marginRight: 8,
    },
    badgeContainer: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        minWidth: 60,
        alignItems: 'center',
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    listContainer: {
        paddingTop: 16,
        paddingBottom: 32
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
        paddingHorizontal: 40,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 16,
        fontSize: 16,
        fontWeight: '500',
    },
});


