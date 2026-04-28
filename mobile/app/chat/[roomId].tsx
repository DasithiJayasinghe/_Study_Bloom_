import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator, Image, StatusBar, Linking, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { chatService } from '@/services/chatService';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, StudyBloomColors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import io, { Socket } from 'socket.io-client';
import { getApiBaseUrl } from '@/utils/apiBaseUrl';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
//chat room
export default function ChatRoomScreen() {
    const { roomId } = useLocalSearchParams<{ roomId: string }>();
    const router = useRouter();
    const { user } = useAuth();

    const [messages, setMessages] = useState<any[]>([]);
    const [roomDetails, setRoomDetails] = useState<any>(null);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [socket, setSocket] = useState<Socket | null>(null);
    const flatListRef = useRef<FlatList>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (!roomId) return;

        const baseUrl = getApiBaseUrl().replace('/api', '');
        const newSocket = io(baseUrl, {
            transports: ['websocket'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
        });

        newSocket.on('connect', () => {
            console.log('Socket connected:', newSocket.id);
            newSocket.emit('joinRoom', roomId);
        });

        newSocket.on('newMessage', (message) => {
            console.log('Received newMessage via socket:', message._id);
            setMessages((prev) => {
                // Prevent duplicates
                const exists = prev.some(m => (m._id || m.id) === (message._id || message.id));
                if (exists) return prev;
                return [...prev, message];
            });
        });

        newSocket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
        });

        newSocket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
        });

        newSocket.on('chatStatusUpdated', (updatedRoom) => {
            console.log('Chat status updated:', updatedRoom.status);
            setRoomDetails(updatedRoom);

            // If chat is resolved, redirect requester to feedback page
            if (updatedRoom.status === 'complete') {
                const currentUserId = (user?.id || user?._id || '').toString();
                const responderId = (updatedRoom.responder?._id || updatedRoom.responder || '').toString();
                const isUserResponder = responderId === currentUserId;

                if (!isUserResponder) {
                    router.replace(`/chat/feedback/${roomId}` as any);
                }
            }
        });

        setSocket(newSocket);
        fetchMessages();

        return () => {
            console.log('Cleaning up chat socket...');
            newSocket.emit('leaveRoom', roomId);
            newSocket.disconnect();
            if (recording) {
                recording.stopAndUnloadAsync();
            }
        };
    }, [roomId]);

    const fetchMessages = async () => {
        try {
            const data = await chatService.getMessages(roomId as string);
            setMessages(data.messages);
            setRoomDetails(data.room);

            // Redirect requester to feedback if session is already completed and feedback not given
            if (data.room?.status === 'complete' && !data.feedbackSubmitted) {
                const currentUserId = (user?.id || user?._id || '').toString();
                const responderId = (data.room.responder?._id || data.room.responder || '').toString();
                const isUserResponder = responderId === currentUserId;

                if (!isUserResponder) {
                    router.replace(`/chat/feedback/${roomId}` as any);
                }
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async () => {
        if (!inputText.trim() || isUploading) return;
        const textToSend = inputText;
        setInputText(''); // Clear quickly for UX
        try {
            setIsUploading(true);
            const sentMessage = await chatService.sendMessage(roomId as string, textToSend);

            // Update locally immediately (optimistic)
            setMessages((prev) => {
                const exists = prev.some(m => m._id === sentMessage._id);
                if (exists) return prev;
                return [...prev, sentMessage];
            });
        } catch (error) {
            console.error('Error sending message:', error);
            setInputText(textToSend); // Restore if failed
            alert('Failed to send message');
        } finally {
            setIsUploading(false);
        }
    };

    const pickDocument = async () => {
        if (isUploading) return;
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setIsUploading(true);
                const file = result.assets[0];
                await chatService.sendMessage(roomId as string, '', [file]);
            }
        } catch (error) {
            console.error(error);
            alert('Failed to upload file');
        } finally {
            setIsUploading(false);
        }
    };

    const startRecording = async () => {
        if (isUploading) return;
        try {
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') {
                alert('Microphone permission is required');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const newRecording = new Audio.Recording();
            await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            await newRecording.startAsync();

            setRecording(newRecording);
            setIsRecording(true);
            console.log('Recording started');
        } catch (error) {
            console.error('Failed to start recording', error);
            alert('Could not start recording. Please check microphone permissions.');
        }
    };

    const stopRecording = async () => {
        if (!recording) return;

        setIsRecording(false);
        setIsUploading(true);
        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            console.log('Recording stopped, URI:', uri);
            if (uri) {
                await chatService.sendMessage(roomId as string, '', [{
                    uri: uri,
                    name: `voice_msg.m4a`,
                    mimeType: 'audio/m4a'
                }]);
            }
        } catch (error) {
            console.error('Failed to stop/send recording', error);
            alert('Failed to send voice message');
        } finally {
            setIsUploading(false);
            setRecording(null);
        }
    };

    const updateStatus = async (status: 'pending' | 'complete') => {
        try {
            await chatService.updateStatus(roomId as string, status);
            setRoomDetails((prev: any) => ({ ...prev, status }));
            if (status === 'complete') router.back();
        } catch (error) {
            console.error(error);
        }
    };

    const playAudio = async (url: string) => {
        try {
            const fullUrl = url.startsWith('http') ? url : `${getApiBaseUrl().replace('/api', '')}${url}`;
            console.log('Attempting to play audio:', fullUrl);

            // Set audio mode for optimal playback
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
                shouldDuckAndroid: true,
                playThroughEarpiece: false,
            });

            const { sound } = await Audio.Sound.createAsync(
                { uri: fullUrl },
                { shouldPlay: true, volume: 1.0 }
            );

            // Monitor status to unload sound when finished
            sound.setOnPlaybackStatusUpdate((status: any) => {
                if (status.didJustFinish) {
                    sound.unloadAsync();
                }
            });
        } catch (error) {
            console.error('Failed to play sound', error);
            alert('Could not play voice message. Please check your internet connection.');
        }
    };

    const downloadFile = async (fileUrl: string, fileName: string) => {
        try {
            const fullUrl = fileUrl.startsWith('http') ? fileUrl : `${getApiBaseUrl().replace('/api', '')}${fileUrl}`;
            console.log('Opening file:', fullUrl);

            const canOpen = await Linking.canOpenURL(fullUrl);
            if (canOpen) {
                await Linking.openURL(fullUrl);
            } else {
                Alert.alert('Error', 'Unable to open file. Please try again.');
            }
        } catch (error) {
            console.error('Failed to download/open file', error);
            Alert.alert('Error', 'Failed to open file');
        }
    };

    const renderAttachments = (attachments: any[]) => {
        if (!attachments || attachments.length === 0) return null;

        const baseUrl = getApiBaseUrl().replace('/api', '');

        return (
            <View style={styles.attachmentsContainer}>
                {attachments.map((att: any, idx: number) => {
                    const isImage = att.mimeType?.startsWith('image/') || att.fileType === 'image';
                    const isAudio = att.mimeType?.startsWith('audio/') || att.fileType === 'audio';
                    const fullUrl = `${baseUrl}${att.fileUrl}`;

                    if (isImage) {
                        return (
                            <TouchableOpacity key={idx} activeOpacity={0.9} style={styles.imageAttachmentWrap}>
                                <Image source={{ uri: fullUrl }} style={styles.imageAttachment} resizeMode="cover" />
                            </TouchableOpacity>
                        );
                    }

                    if (isAudio) {
                        return (
                            <TouchableOpacity
                                key={idx}
                                style={styles.audioAttachment}
                                onPress={() => playAudio(att.fileUrl)}
                            >
                                <View style={styles.audioIconWrapper}>
                                    <Ionicons name="play" size={16} color="#FFF" />
                                </View>
                                <View style={styles.audioWaveformMock}>
                                    <View style={[styles.waveBar, { height: 10 }]} />
                                    <View style={[styles.waveBar, { height: 15 }]} />
                                    <View style={[styles.waveBar, { height: 12 }]} />
                                    <View style={[styles.waveBar, { height: 18 }]} />
                                    <View style={[styles.waveBar, { height: 8 }]} />
                                </View>
                                <Text style={styles.audioDurationText}>{att.size ? `${(att.size / 1024).toFixed(0)}KB` : 'Voice'}</Text>
                            </TouchableOpacity>
                        );
                    }

                    return (
                        <TouchableOpacity
                            key={idx}
                            style={styles.fileAttachment}
                            onPress={() => downloadFile(att.fileUrl, att.fileName)}
                        >
                            <Ionicons name="download" size={18} color={StudyBloomColors.primary} />
                            <Text style={styles.fileAttachmentText} numberOfLines={1}>{att.fileName || 'File'}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        );
    };

    const renderItem = ({ item, index }: { item: any, index: number }) => {
        const senderId = (item.sender?._id || item.sender || '').toString();
        const currentUserId = (user?.id || user?._id || '').toString();
        const isMe = senderId === currentUserId;
        const showDate = index === 0;

        return (
            <View>
                {showDate && (
                    <Text style={styles.timestamp}>Tue 3:15 PM</Text>
                )}

                {index === 0 && !isMe && roomDetails?.status === 'pending' && (
                    <View style={styles.systemBox}>
                        <Text style={styles.systemText}>
                            <Text style={{ fontWeight: '700' }}>StudyBloom:</Text> You have opened a private response session. Click 'Accept Request' to begin assisting.
                        </Text>
                        <TouchableOpacity style={styles.gradientBtnContainer}>
                            <LinearGradient
                                colors={['#FF6B95', '#A155B9']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.acceptBtn}
                            >
                                <Text style={styles.acceptBtnText}>Accept Request</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.otherMessage]}>
                    {item.text ? <Text style={[isMe ? styles.myMessageText : styles.otherMessageText]}>{item.text}</Text> : null}
                    {renderAttachments(item.attachments)}
                </View>
            </View>
        );
    };

    if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D81B60" size="large" /></SafeAreaView>;

    const currentUserId = (user?.id || user?._id || '').toString();
    const responderId = (roomDetails?.responder?._id || roomDetails?.responder || '').toString();
    const isResponder = responderId === currentUserId;
    const isComplete = roomDetails?.status === 'complete';
    const requesterId = (roomDetails?.requester?._id || '').toString();
    const otherUser = requesterId === currentUserId ? roomDetails?.responder : roomDetails?.requester;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color="#555" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle} numberOfLines={1}>Chat with {otherUser?.fullName || ''}</Text>
                    <View style={[styles.statusBadge, isComplete ? styles.statusResolved : styles.statusOpen]}>
                        <Text style={styles.statusBadgeText}>{isComplete ? 'Resolved' : 'Active'}</Text>
                    </View>
                    {isResponder && !isComplete && (
                        <TouchableOpacity onPress={() => updateStatus('complete')} style={styles.markResolvedBtn}>
                            <Text style={styles.markResolvedText}>Mark as Resolved</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </SafeAreaView>

            <LinearGradient colors={['#FF6B95', '#A155B9']} style={styles.userStrip}>
                <View style={styles.userInfo}>
                    <View style={styles.avatar}>
                        <Ionicons name="person-circle" size={60} color="#FFF" />
                    </View>
                    <View>
                        <Text style={styles.userName}>{otherUser?.fullName || ''}</Text>
                        <Text style={styles.userTopic}>{roomDetails?.concern?.title || "Help Request"}</Text>
                    </View>
                </View>
            </LinearGradient>

            <View style={styles.chatArea}>
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(item) => item._id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContainer}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                    showsVerticalScrollIndicator={false}
                />

                {!isComplete && (
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20} style={styles.inputSection}>
                        <View style={[styles.inputControls, isUploading && { opacity: 0.6 }]}>
                            <TouchableOpacity onPress={pickDocument} style={styles.controlBtn} disabled={isUploading}>
                                <Ionicons name="attach" size={22} color="#FFF" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={isRecording ? stopRecording : startRecording} style={[styles.controlBtn, isRecording && styles.recordingActive]} disabled={isUploading}>
                                <Ionicons name="mic" size={22} color="#FFF" />
                            </TouchableOpacity>
                            <View style={styles.inputWrapper}>
                                <TextInput
                                    style={styles.textInput}
                                    value={inputText}
                                    onChangeText={setInputText}
                                    placeholder={isUploading ? "Uploading..." : "Type your response..."}
                                    placeholderTextColor="#999"
                                    multiline
                                    editable={!isUploading}
                                />
                                {isUploading ? (
                                    <ActivityIndicator size="small" color="#D81B60" style={{ marginRight: 8 }} />
                                ) : (
                                    <TouchableOpacity onPress={handleSend} style={styles.sendIconBtn}>
                                        <Ionicons name="send" size={18} color="#D81B60" style={{ marginLeft: 2 }} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    safeArea: { backgroundColor: '#FDF2F8' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FDF2F8',
        gap: 8,
    },
    backBtn: { padding: 4 },
    headerTitle: {
        flex: 1, fontSize: 16, fontWeight: '700', color: '#444',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusOpen: { backgroundColor: '#E8F5E9' },
    statusResolved: { backgroundColor: '#ECEFF1' },
    statusBadgeText: { fontSize: 10, fontWeight: '700', color: '#666' },
    markResolvedBtn: {
        backgroundColor: '#EC407A',
        paddingHorizontal: 10, paddingVertical: 6,
        borderRadius: 8,
    },
    markResolvedText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
    userStrip: {
        paddingHorizontal: 24, paddingVertical: 16,
        paddingBottom: 40,
    },
    userInfo: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    avatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#FFF' },
    userName: { color: '#FFF', fontSize: 18, fontWeight: '700' },
    userTopic: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 2 },
    chatArea: {
        flex: 1, backgroundColor: '#FFF',
        marginTop: -25, borderTopLeftRadius: 30, borderTopRightRadius: 30,
        paddingTop: 10,
    },
    listContainer: { paddingHorizontal: 20, paddingBottom: 20 },
    timestamp: {
        textAlign: 'center',
        color: '#999',
        fontSize: 11,
        marginVertical: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    attachmentsContainer: {
        marginTop: 6,
        gap: 8,
    },
    imageAttachmentWrap: {
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 4,
    },
    imageAttachment: {
        width: 200,
        height: 150,
        backgroundColor: '#eee',
    },
    audioAttachment: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 20,
        minWidth: 140,
        marginTop: 4,
        gap: 8,
    },
    audioIconWrapper: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: StudyBloomColors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    audioWaveformMock: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        flex: 1,
    },
    waveBar: {
        width: 3,
        backgroundColor: '#FFF',
        borderRadius: 1.5,
    },
    audioDurationText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '600',
    },
    fileAttachment: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3E5F5',
        padding: 8,
        borderRadius: 8,
        gap: 8,
        marginTop: 4,
    },
    fileAttachmentText: {
        fontSize: 13,
        color: '#4A148C',
        fontWeight: '500',
        maxWidth: 150,
    },
    systemBox: {
        backgroundColor: '#FFF5F8',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderLeftWidth: 4,
        borderLeftColor: '#A155B9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    systemText: { fontSize: 13, color: '#666', lineHeight: 20 },
    gradientBtnContainer: { marginTop: 12 },
    acceptBtn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    acceptBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
    messageBubble: { maxWidth: '85%', marginBottom: 12, padding: 14, borderRadius: 20 },
    myMessage: { alignSelf: 'flex-end', backgroundColor: '#EC407A', borderBottomRightRadius: 4 },
    otherMessage: { alignSelf: 'flex-start', backgroundColor: '#F1F2F6', borderBottomLeftRadius: 4 },
    myMessageText: { color: '#FFF', fontSize: 15, lineHeight: 22 },
    otherMessageText: { color: '#2D3436', fontSize: 15, lineHeight: 22 },
    attachment: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        marginTop: 8, padding: 10, backgroundColor: 'rgba(255,255,255,0.8)',
        borderRadius: 12,
    },
    attachmentText: { fontSize: 13, color: '#D81B60', fontWeight: '600' },
    inputSection: {
        paddingHorizontal: 16, paddingBottom: Platform.OS === 'ios' ? 25 : 15,
        paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0F0F0',
    },
    inputControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    controlBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: '#EC407A', justifyContent: 'center', alignItems: 'center',
    },
    recordingActive: { backgroundColor: '#FF5252' },
    inputWrapper: {
        flex: 1, flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#F1F2F6', borderRadius: 25, paddingHorizontal: 16,
    },
    textInput: {
        flex: 1, paddingVertical: 10, fontSize: 15, color: '#333', maxHeight: 80,
    },
    sendIconBtn: { padding: 4 },
});

