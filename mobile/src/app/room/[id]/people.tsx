/**
 * People tab:
 * - Room share card with instant invite link sharing
 * - Host moderation deck (Guest Playback Controls toggle)
 * - Roster of active listeners sorted with Host first & You indicators
 * - Discord avatar rendering and color-coded fallback badges
 */
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Share2, Crown, Activity, User, Edit3, Trash2, QrCode, Copy } from 'lucide-react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { colors, radius, spacing } from '../../../theme';
import { fontFamily } from '../../../fonts';
import { useRoom } from '../../../state/RoomContext';
import { initials, nameColor } from '../../../components/ChatPanel';
import { ProfileModal } from '../../../components/ProfileModal';
import { EditRoomModal, ListenerActionModal, RoomInviteModal } from '../../../components/Modals';
import { clearSession, getStoredSession, joinAsGuest, getBackendUrl, saveAuthToken, type ApiUser } from '../../../api';
import { useToast } from '../../../components/ToastContext';
import { copyToClipboard } from '../../../utils/clipboard';
import { hapticLight } from '../../../utils/haptics';
import type { PlayedTrack } from '../../../storage/history';

export default function PeopleTab() {
  const {
    roomId,
    roomName,
    listeners,
    me,
    isHost,
    guestControls,
    toggleGuestControls,
    closeRoom,
    updateRoomDetails,
    transferHost,
    kickUser,
  } = useRoom();
  const toast = useToast();
  const [showProfile, setShowProfile] = useState(false);
  const [showEditRoom, setShowEditRoom] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedListener, setSelectedListener] = useState<any | null>(null);
  const [sessionUser, setSessionUser] = useState<ApiUser | null>(null);

  useEffect(() => {
    void getStoredSession().then((s) => {
      if (s.user) setSessionUser(s.user);
    });
  }, []);

  const handleUpdateGuestName = async (newName: string) => {
    try {
      const { user: u } = await joinAsGuest(newName);
      setSessionUser(u);
      toast(`Guest name updated to "${u.display_name}"`, 'success');
    } catch {
      toast('Could not update guest profile', 'error');
    }
  };

  const handleSignOut = async () => {
    await clearSession();
    setSessionUser(null);
    toast('Signed out', 'info');
  };

  const handleDiscordLogin = async () => {
    try {
      const backendUrl = getBackendUrl();
      const redirectScheme = Linking.createURL('/');
      const authUrl = `${backendUrl}/auth/discord?state=${encodeURIComponent(redirectScheme)}`;

      const res = await WebBrowser.openAuthSessionAsync(authUrl, redirectScheme);

      if (res.type === 'success' && res.url) {
        const url = res.url;
        const match = url.match(/[?&#]token=([^&]+)/);
        const token = match ? decodeURIComponent(match[1]) : null;
        if (token) {
          const profile = await saveAuthToken(token);
          if (profile) {
            setSessionUser(profile);
            toast(
              `Connected as ${profile.discord_username ? '@' + profile.discord_username : profile.display_name}!`,
              'success',
            );
          }
        }
      }
    } catch {
      toast('Could not connect to Discord', 'error');
    }
  };

  const handleJoinRoom = (targetRoomId: string) => {
    setShowProfile(false);
    if (targetRoomId !== roomId) {
      router.replace({ pathname: '/room/[id]', params: { id: targetRoomId } });
    }
  };

  const handlePlayTrack = (track: PlayedTrack) => {
    setShowProfile(false);
    if (track.roomId && track.roomId !== roomId) {
      router.replace({ pathname: '/room/[id]', params: { id: track.roomId } });
    }
  };

  const handleCopyCode = async () => {
    void hapticLight();
    const ok = await copyToClipboard(roomId);
    if (ok) {
      toast(`Room code "#${roomId}" copied! Share with friends.`, 'success');
    } else {
      toast(`Room code is #${roomId}`, 'info');
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join my live room "${roomName || 'OpenJam Room'}" on OpenJam!\nRoom Code: #${roomId}\nLink: https://www.openjam.fun/room/${roomId}`,
        title: `OpenJam – ${roomName || 'Live Room'}`,
      });
    } catch {
      // dismissed
    }
  };

  const handleCloseRoom = () => {
    Alert.alert(
      'Close & Delete Room?',
      'This will end the session and remove the room for all connected listeners.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close Room',
          style: 'destructive',
          onPress: async () => {
            await closeRoom();
            toast('Room closed', 'info');
            router.replace('/');
          },
        },
      ],
    );
  };

  const handleTransferHost = (targetUserId: string, targetUserName: string) => {
    Alert.alert(
      'Make Room Host?',
      `Are you sure you want to pass host privileges to ${targetUserName}? You will become a regular listener.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Make Host',
          style: 'default',
          onPress: () => {
            transferHost(targetUserId);
          },
        },
      ],
    );
  };

  const handleKickUser = (targetUserId: string, targetUserName: string) => {
    Alert.alert(
      'Remove from Room?',
      `Are you sure you want to remove ${targetUserName} from this room?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            kickUser(targetUserId);
          },
        },
      ],
    );
  };

  // Sort listeners: Hosts first, then current user, then others alphabetically
  const sortedListeners = [...listeners].sort((a, b) => {
    if (a.is_host && !b.is_host) return -1;
    if (!a.is_host && b.is_host) return 1;
    if (me && a.user_id === me.id) return -1;
    if (me && b.user_id === me.id) return 1;
    return a.user_name.localeCompare(b.user_name);
  });

  return (
    <View style={styles.safe}>
      <FlatList
        data={sortedListeners}
        keyExtractor={(l) => l.user_id}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Room Share / Invite Card */}
            <View style={styles.shareCard}>
              <View style={styles.shareMeta}>
                <Text style={styles.shareTitle}>Invite Friends to Jam</Text>
                <Pressable
                  onPress={handleCopyCode}
                  style={({ pressed }) => [styles.shareCodePill, pressed && styles.pressed]}
                  hitSlop={6}
                  accessibilityLabel={`Copy room code #${roomId}`}
                >
                  <Copy size={11} color={colors.amber} />
                  <Text style={styles.shareCodeText}>#{roomId}</Text>
                  <Text style={styles.shareCodeCopyHint}>Tap to copy</Text>
                </Pressable>
              </View>
              <View style={styles.shareActionsRow}>
                <Pressable
                  onPress={() => setShowInviteModal(true)}
                  style={({ pressed }) => [styles.qrBtn, pressed && styles.pressed]}
                  hitSlop={8}
                  accessibilityLabel="Show QR code invite"
                >
                  <QrCode size={16} color={colors.amber} />
                </Pressable>
                <Pressable
                  onPress={handleShare}
                  style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed]}
                  hitSlop={8}
                  accessibilityLabel="Share room invite"
                >
                  <LinearGradient
                    colors={['#ffb03a', '#ff9f1c']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.shareGradient}
                  >
                    <Share2 size={13} color="#08080a" />
                    <Text style={styles.shareBtnText}>Share</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>

            {/* Host Moderation & Playback Controls Deck */}
            {isHost ? (
              <View style={styles.hostCard}>
                <View style={styles.hostCardHeader}>
                  <Text style={styles.hostCardBadge}>HOST CONTROLS</Text>
                </View>
                <View style={styles.hostRow}>
                  <View style={styles.hostInfo}>
                    <Text style={styles.hostTitle}>Guest Playback Controls</Text>
                    <Text style={styles.hostDesc}>
                      Allow anyone in the room to play, pause, seek, and reorder the queue.
                    </Text>
                  </View>
                  <Switch
                    value={guestControls}
                    onValueChange={toggleGuestControls}
                    trackColor={{ true: colors.amber, false: 'rgba(255, 255, 255, 0.15)' }}
                    thumbColor={colors.white}
                  />
                </View>

                <View style={styles.hostButtonsRow}>
                  <Pressable
                    onPress={() => setShowEditRoom(true)}
                    style={({ pressed }) => [styles.hostEditBtn, pressed && styles.pressed]}
                    accessibilityLabel="Edit room settings"
                  >
                    <Edit3 size={13} color={colors.amber} />
                    <Text style={styles.hostEditBtnText}>Edit Details</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleCloseRoom}
                    style={({ pressed }) => [styles.hostDeleteBtn, pressed && styles.pressed]}
                    accessibilityLabel="Close and delete room"
                  >
                    <Trash2 size={13} color="#ef4444" />
                    <Text style={styles.hostDeleteBtnText}>Close Room</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* Listeners Header */}
            <View style={styles.listHeaderRow}>
              <View style={styles.listHeaderLeft}>
                <View style={styles.liveDot} />
                <Text style={styles.listHeaderTitle}>
                  LISTENERS IN ROOM ({listeners.length})
                </Text>
              </View>

              <Pressable
                onPress={() => setShowProfile(true)}
                style={({ pressed }) => [styles.myProfileBtn, pressed && styles.pressed]}
                hitSlop={8}
                accessibilityLabel="View your profile"
              >
                <User size={12} color={colors.amber} />
                <Text style={styles.myProfileBtnText}>My Profile</Text>
              </Pressable>
            </View>
          </>
        }
        renderItem={({ item }) => {
          const isMe = me && item.user_id === me.id;
          return (
            <Pressable
              onPress={isMe ? () => setShowProfile(true) : () => setSelectedListener(item)}
              style={({ pressed }) => [
                styles.listenerCard,
                isMe && styles.listenerCardMe,
                pressed && styles.pressed,
              ]}
              accessibilityLabel={isMe ? 'Open profile' : `Manage ${item.user_name}`}
            >
              <View style={styles.avatarWrap}>
                {item.avatar_url ? (
                  <Image
                    source={{ uri: item.avatar_url }}
                    style={styles.avatar}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: nameColor(item.user_name) },
                    ]}
                  >
                    <Text style={styles.avatarInitial}>{initials(item.user_name)}</Text>
                  </View>
                )}
                <View style={styles.onlineDot} />
              </View>

              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.user_name}
                  </Text>
                  {isMe ? (
                    <View style={styles.youBadge}>
                      <Text style={styles.youBadgeText}>YOU</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.statusRow}>
                  <Activity size={11} color={colors.text3} />
                  <Text style={styles.statusText}>Listening in sync</Text>
                </View>
              </View>

              {item.is_host ? (
                <View style={styles.hostBadge}>
                  <Crown size={9} color={colors.amber} />
                  <Text style={styles.hostBadgeText}>HOST</Text>
                </View>
              ) : (
                <View style={styles.memberBadge}>
                  <Text style={styles.memberBadgeText}>LISTENER</Text>
                </View>
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>You're jamming solo</Text>
            <Text style={styles.emptyDesc}>
              Tap the share button above to send the invite link to your friends!
            </Text>
          </View>
        }
      />

      <ProfileModal
        visible={showProfile}
        user={sessionUser || me}
        currentName={sessionUser?.display_name || me?.display_name}
        onClose={() => setShowProfile(false)}
        onUpdateGuestName={handleUpdateGuestName}
        onDiscordLogin={handleDiscordLogin}
        onSignOut={handleSignOut}
        onJoinRoom={handleJoinRoom}
        onPlayTrack={handlePlayTrack}
      />

      <EditRoomModal
        visible={showEditRoom}
        currentName={roomName}
        onClose={() => setShowEditRoom(false)}
        onSave={async (data) => {
          await updateRoomDetails(data);
        }}
      />

      <ListenerActionModal
        visible={!!selectedListener}
        listener={selectedListener}
        isHostViewer={isHost}
        onClose={() => setSelectedListener(null)}
        onMention={(targetName) => {
          setSelectedListener(null);
          router.push({
            pathname: '/room/[id]/chat',
            params: { id: roomId, mention: targetName },
          });
        }}
        onTransferHost={handleTransferHost}
        onKickListener={handleKickUser}
        onViewProfile={(targetUserId) => {
          setSelectedListener(null);
          router.push({
            pathname: '/profile/[id]',
            params: { id: targetUserId },
          });
        }}
      />

      <RoomInviteModal
        visible={showInviteModal}
        roomId={roomId}
        roomName={roomName}
        onClose={() => setShowInviteModal(false)}
        onShare={handleShare}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  container: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl * 1.5,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  // Share Card
  shareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  shareMeta: {
    flex: 1,
  },
  shareTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 15,
    color: colors.text1,
  },
  shareCodePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 159, 28, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  shareCodeText: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 12,
    color: colors.amber,
  },
  shareCodeCopyHint: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10,
    color: colors.text3,
  },
  shareCode: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.text3,
    marginTop: 2,
  },
  shareActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qrBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtn: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: colors.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  shareGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  shareBtnGlyph: {
    fontSize: 14,
    color: '#08080a',
    fontWeight: 'bold',
  },
  shareBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    color: '#08080a',
  },
  // Host Controls Card
  hostCard: {
    backgroundColor: 'rgba(255, 159, 28, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.25)',
    borderRadius: 18,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  hostCardHeader: {
    marginBottom: spacing.xs,
  },
  hostCardBadge: {
    fontFamily: fontFamily.displayBold,
    fontSize: 10,
    color: colors.amber,
    letterSpacing: 1,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  hostInfo: {
    flex: 1,
  },
  hostTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14,
    color: colors.text1,
  },
  hostDesc: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.text3,
    marginTop: 3,
    lineHeight: 16,
  },
  hostButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  hostEditBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 159, 28, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
    borderRadius: radius.md,
    paddingVertical: 9,
  },
  hostEditBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: colors.amber,
  },
  hostDeleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: radius.md,
    paddingVertical: 9,
  },
  hostDeleteBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: '#ef4444',
  },
  // Listeners List Header
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: 4,
  },
  listHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green,
  },
  listHeaderTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 11,
    color: colors.text3,
    letterSpacing: 1,
  },
  myProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 159, 28, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.25)',
  },
  myProfileBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: colors.amber,
  },
  // Listener Row Card
  listenerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 22, 32, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: 12,
  },
  listenerCardMe: {
    borderColor: 'rgba(255, 159, 28, 0.3)',
    backgroundColor: 'rgba(255, 159, 28, 0.06)',
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fontFamily.displayBold,
    fontSize: 16,
    color: '#08080a',
  },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.green,
    borderWidth: 2,
    borderColor: colors.bgBase,
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 15,
    color: colors.text1,
  },
  youBadge: {
    backgroundColor: 'rgba(255, 159, 28, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  youBadgeText: {
    fontFamily: fontFamily.displayBold,
    fontSize: 9,
    color: colors.amber,
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  statusText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11.5,
    color: colors.text3,
  },
  hostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 159, 28, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  hostBadgeText: {
    fontFamily: fontFamily.displayBold,
    fontSize: 10,
    color: colors.amber,
    letterSpacing: 0.5,
  },
  memberBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  memberBadgeText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 10,
    color: colors.text3,
    letterSpacing: 0.5,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  emptyTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 16,
    color: colors.text1,
  },
  emptyDesc: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: colors.text3,
    textAlign: 'center',
    marginTop: 4,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
});
