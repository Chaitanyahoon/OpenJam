import React, { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LogIn,
  Shuffle,
  X,
  LogOut,
  AlertCircle,
  RefreshCw,
  MessageSquare,
  Crown,
  User,
  UserX,
  QrCode,
  Headphones,
  Sparkles,
  KeyRound,
} from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { fontFamily } from '../fonts';
import { Field, PrimaryButton, Title, Subtitle } from './ui';
import { createRoom, type ApiUser } from '../api';
import { hapticMedium } from '../utils/haptics';

const openjamEmblem = require('../../assets/images/openjam-emblem.png');

function Shell({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[
          styles.backdrop,
          {
            paddingTop: Math.max(insets.top, spacing.lg),
            paddingBottom: Math.max(insets.bottom, spacing.lg),
          },
        ]}
        onPress={onClose}
      >
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const AVAILABLE_TAGS = [
  'lofi', 'chill', 'synthwave', 'hip-hop', 'electronic', 'rock', 'pop', 'jazz', 'ambient'
];

const COOL_ROOM_NAMES = [
  'Late Night Lofi', 'Synthwave Sunset', 'Neon Dreams', 'Chill Study Cafe',
  'Cosmic Beats Lounge', 'Midnight Rhythm Club', 'Analog Warmth', 'Lo-Fi Chill Hop',
  'Velvet Underground', 'Deep Focus Session', 'Solar Grooves', 'Retro Arcade FM',
];

function getRandomRoomName() {
  const base = COOL_ROOM_NAMES[Math.floor(Math.random() * COOL_ROOM_NAMES.length)];
  const num = Math.floor(Math.random() * 90) + 10;
  return `${base} #${num}`;
}

export function CreateRoomModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (roomId: string) => void;
}) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [allowGuestControls, setAllowGuestControls] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(['lofi', 'chill']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rollRoomName = () => {
    void hapticMedium();
    setName(getRandomRoomName());
  };

  const toggleTag = (tag: string) => {
    void hapticMedium();
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length < 3 ? [...prev, tag] : prev,
    );
  };

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const room = await createRoom({
        name: name.trim(),
        password: password,
        is_private: isPrivate,
        genre_tags: selectedTags,
        allow_guest_controls: allowGuestControls,
      });
      setName('');
      setPassword('');
      onCreated(room.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create room');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell visible={visible} onClose={onClose}>
      <View style={styles.createModalBadge}>
        <Sparkles size={11} color={colors.amber} strokeWidth={2.4} />
        <Text style={styles.createModalBadgeText}>LIVE AUDIO ROOM</Text>
      </View>
      <Title>Start a New Jam</Title>
      <Subtitle style={styles.sub}>Spin up a room in seconds. Invite friends with a link.</Subtitle>
      <View style={styles.gap} />

      <View style={styles.inputWithDice}>
        <View style={{ flex: 1 }}>
          <Field
            value={name}
            onChangeText={setName}
            placeholder="Room name (e.g. Late Night Lofi)"
          />
        </View>
        <Pressable onPress={rollRoomName} style={styles.diceBtn} accessibilityLabel="Randomize room name">
          <Shuffle size={20} color={colors.amber} />
        </Pressable>
      </View>

      <Text style={styles.tagSectionLabel}>Vibe & Genres (up to 3)</Text>
      <View style={styles.tagChipsPicker}>
        {AVAILABLE_TAGS.map((tag) => {
          const active = selectedTags.includes(tag);
          return (
            <Pressable
              key={tag}
              onPress={() => toggleTag(tag)}
              style={({ pressed }) => [
                styles.pickerChip,
                active && styles.pickerChipActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.pickerChipText, active && styles.pickerChipTextActive]}>
                {tag}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.switchRow}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.switchLabel}>Guest playback controls</Text>
          <Text style={styles.switchDesc}>Allow listeners to play, pause, seek, and reorder</Text>
        </View>
        <Switch
          value={allowGuestControls}
          onValueChange={setAllowGuestControls}
          trackColor={{ true: colors.amber, false: 'rgba(255, 255, 255, 0.15)' }}
          thumbColor={colors.white}
        />
      </View>

      <View style={styles.switchRow}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.switchLabel}>Private room</Text>
          <Text style={styles.switchDesc}>Require a password to join</Text>
        </View>
        <Switch
          value={isPrivate}
          onValueChange={setIsPrivate}
          trackColor={{ true: colors.amber, false: 'rgba(255, 255, 255, 0.15)' }}
          thumbColor={colors.white}
        />
      </View>

      {isPrivate ? (
        <View style={{ marginTop: spacing.sm }}>
          <Field
            value={password}
            onChangeText={setPassword}
            placeholder="Room password"
            secureTextEntry
            autoCapitalize="none"
          />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.gap} />
      <PrimaryButton title={busy ? 'Creating…' : 'Create & Join'} onPress={submit} disabled={busy || !name.trim()} />
    </Shell>
  );
}

const COOL_NAMES = [
  'SonicWave', 'VelvetGroove', 'LofiAstronaut', 'VinylVibe', 'NeonEcho',
  'MidnightRhythm', 'CosmicJammer', 'RetroPulse', 'Subwoofer', 'SynthRider',
  'BasslineHero', 'ChillHopGuru', 'AnalogDreamer', 'SolarCadence', 'AuraBeat',
];

function getRandomName() {
  const base = COOL_NAMES[Math.floor(Math.random() * COOL_NAMES.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${base}${num}`;
}

export function IdentityModal({
  visible,
  user,
  currentName,
  authError,
  onClearError,
  onDone,
  onDiscordLogin,
  onSignOut,
  onClose,
}: {
  visible: boolean;
  user?: ApiUser | null;
  currentName?: string;
  authError?: string | null;
  onClearError?: () => void;
  onDone: (displayName: string) => void;
  onDiscordLogin?: () => void;
  onSignOut?: () => void;
  onClose?: () => void;
}) {
  const [name, setName] = useState(currentName || '');

  useEffect(() => {
    if (currentName) setName(currentName);
  }, [currentName]);

  const initials = (user?.display_name || name.trim() || '?').slice(0, 2).toUpperCase();

  const rollName = () => {
    void hapticMedium();
    setName(getRandomName());
  };

  const isDiscord = !!user?.discord_id || !!user?.is_registered;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheet}
        >
          {onClose ? (
            <Pressable
              onPress={() => {
                onClearError?.();
                onClose();
              }}
              style={styles.closeModalBtn}
              hitSlop={12}
              accessibilityLabel="Close welcome sheet"
            >
              <X size={16} color={colors.text2} />
            </Pressable>
          ) : null}

          {isDiscord ? (
            <View style={{ alignItems: 'center' }}>
              {user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.discordAvatarLarge} />
              ) : (
                <View style={[styles.avatarPreview, { backgroundColor: '#5865F2' }]}>
                  <Text style={styles.avatarPreviewText}>{initials}</Text>
                </View>
              )}

              <Title style={{ textAlign: 'center', marginTop: 12 }}>
                {user?.display_name || name}
              </Title>
              {user?.discord_username ? (
                <Text style={styles.discordTag}>@{user.discord_username}</Text>
              ) : null}

              <View style={styles.discordBadgeRow}>
                <Text style={styles.discordBadgeText}>Discord Verified • Full Access</Text>
              </View>

              <View style={styles.gap} />
              <Pressable
                onPress={() => {
                  onSignOut?.();
                  onClose?.();
                }}
                style={({ pressed }) => [styles.signOutBtn, pressed && styles.pressed]}
              >
                <Text style={styles.signOutText}>Sign Out</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.welcomeScrollContent}
            >
              {/* Brand Emblem with Ambient Aura */}
              <View style={styles.welcomeHeroWrap}>
                <View style={styles.welcomeEmblemAura} pointerEvents="none" />
                <View style={styles.welcomeEmblemWrap}>
                  <Image
                    source={openjamEmblem}
                    style={styles.welcomeEmblem}
                    resizeMode="contain"
                  />
                </View>
              </View>

              <Title style={styles.welcomeTitle}>Welcome to OpenJam</Title>
              <Text style={styles.welcomeSubtitle}>Listen together in sync.</Text>

              {/* Sign-In Error Alert Banner */}
              {authError ? (
                <View style={styles.authErrorCard}>
                  <View style={styles.authErrorHeader}>
                    <AlertCircle size={15} color={colors.red} />
                    <Text style={styles.authErrorTitle}>Sign-in Interrupted</Text>
                  </View>
                  <Text style={styles.authErrorDesc}>{authError}</Text>
                </View>
              ) : null}

              {/* Primary Action: Discord */}
              {onDiscordLogin ? (
                <View style={styles.discordActionWrap}>
                  <Pressable
                    onPress={() => {
                      onClearError?.();
                      onDiscordLogin();
                    }}
                    style={({ pressed }) => [styles.discordLoginBtn, pressed && styles.pressed]}
                    accessibilityLabel="Continue with Discord"
                  >
                    <LogIn size={18} color="#ffffff" strokeWidth={2.4} />
                    <Text style={styles.discordLoginBtnText}>Continue with Discord</Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.welcomeDividerRow}>
                <View style={styles.welcomeDividerLine} />
                <Text style={styles.welcomeDividerText}>or</Text>
                <View style={styles.welcomeDividerLine} />
              </View>

              {/* Secondary Action: Instant Guest Access */}
              <View style={styles.guestActionWrap}>
                <View style={styles.inputWithDice}>
                  <View style={{ flex: 1 }}>
                    <Field
                      value={name}
                      onChangeText={setName}
                      placeholder="Choose a nickname"
                      onSubmitEditing={() => onDone(name.trim() || getRandomName())}
                    />
                  </View>
                  <Pressable
                    onPress={rollName}
                    style={({ pressed }) => [styles.diceBtn, pressed && styles.pressed]}
                    accessibilityLabel="Roll random nickname"
                    hitSlop={6}
                  >
                    <Shuffle size={18} color={colors.amber} strokeWidth={2.2} />
                  </Pressable>
                </View>

                <View style={{ height: 10 }} />
                <PrimaryButton
                  title={name.trim() ? `Continue as "${name.trim()}"` : 'Enter as Guest'}
                  onPress={() => onDone(name.trim() || getRandomName())}
                />
              </View>

              {/* Option 3: Passive Exploration */}
              {onClose ? (
                <Pressable
                  onPress={() => {
                    onClearError?.();
                    onClose();
                  }}
                  style={({ pressed }) => [styles.browseWithoutSignInBtn, pressed && styles.pressed]}
                  hitSlop={10}
                  accessibilityLabel="Browse rooms without signing in"
                >
                  <Text style={styles.browseWithoutSignInText}>Browse rooms</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export function JoinWithCodeModal({
  visible,
  onClose,
  onJoin,
}: {
  visible: boolean;
  onClose: () => void;
  onJoin: (roomCode: string) => void;
}) {
  const [code, setCode] = useState('');

  const handleJoin = () => {
    if (!code.trim()) return;
    void hapticMedium();
    onJoin(code.trim());
  };

  return (
    <Shell visible={visible} onClose={onClose}>
      <View style={styles.createModalBadge}>
        <KeyRound size={11} color={colors.amber} strokeWidth={2.4} />
        <Text style={styles.createModalBadgeText}>DIRECT ACCESS</Text>
      </View>
      <Title>Join with Code</Title>
      <Subtitle style={styles.sub}>Enter room ID or paste room link to jump straight in.</Subtitle>
      <View style={styles.gap} />
      <Field
        value={code}
        onChangeText={setCode}
        placeholder="e.g. synthwave-chill or room link"
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={handleJoin}
      />
      <View style={styles.gap} />
      <PrimaryButton
        title="Join Room"
        onPress={handleJoin}
        disabled={!code.trim()}
      />
    </Shell>
  );
}

export function RoomPasswordModal({
  visible,
  roomName,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  roomName: string;
  onClose: () => void;
  onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState('');
  return (
    <Shell visible={visible} onClose={onClose}>
      <Title>Join {roomName}</Title>
      <Subtitle style={styles.sub}>This room is locked — enter the password.</Subtitle>
      <View style={styles.gap} />
      <Field
        value={password}
        onChangeText={setPassword}
        placeholder="Room password"
        secureTextEntry
        autoCapitalize="none"
        onSubmitEditing={() => onSubmit(password)}
      />
      <View style={styles.gap} />
      <PrimaryButton title="Join room" onPress={() => onSubmit(password)} />
    </Shell>
  );
}

export function LeaveModal({
  visible,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Shell visible={visible} onClose={onClose}>
      <View style={styles.leaveIconWrap}>
        <LogOut size={40} color={colors.red} />
      </View>
      <Title style={{ textAlign: 'center' }}>Leave Session?</Title>
      <Subtitle style={[styles.sub, { textAlign: 'center' }]}>
        You will be seamlessly removed from this live room. Are you sure you want to leave?
      </Subtitle>
      <View style={styles.gap} />
      <View style={styles.leaveBtnRow}>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.stayBtn, pressed && styles.pressed]}
        >
          <Text style={styles.stayBtnText}>Stay</Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          style={({ pressed }) => [styles.confirmLeaveBtn, pressed && styles.pressed]}
        >
          <Text style={styles.confirmLeaveText}>Yes, Leave</Text>
        </Pressable>
      </View>
    </Shell>
  );
}

export function EditRoomModal({
  visible,
  currentName,
  currentTags,
  onClose,
  onSave,
}: {
  visible: boolean;
  currentName: string;
  currentTags?: string[];
  onClose: () => void;
  onSave: (data: { name: string; genre_tags: string[] }) => Promise<void>;
}) {
  const [name, setName] = useState(currentName);
  const [selectedTags, setSelectedTags] = useState<string[]>(currentTags || ['lofi', 'chill']);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(currentName);
    if (currentTags && currentTags.length > 0) {
      setSelectedTags(currentTags);
    }
  }, [currentName, currentTags, visible]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length < 3 ? [...prev, tag] : prev,
    );
  };

  const handleSave = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await onSave({ name: name.trim(), genre_tags: selectedTags });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell visible={visible} onClose={onClose}>
      <Title>Edit Room Details</Title>
      <Subtitle style={styles.sub}>Update room name and vibe tags live in real-time.</Subtitle>
      <View style={styles.gap} />
      <Field value={name} onChangeText={setName} placeholder="Room name" />

      <Text style={styles.tagSectionLabel}>Vibe & Genres (up to 3)</Text>
      <View style={styles.tagChipsPicker}>
        {AVAILABLE_TAGS.map((tag) => {
          const active = selectedTags.includes(tag);
          return (
            <Pressable
              key={tag}
              onPress={() => toggleTag(tag)}
              style={({ pressed }) => [
                styles.pickerChip,
                active && styles.pickerChipActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.pickerChipText, active && styles.pickerChipTextActive]}>
                {tag}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.gap} />
      <PrimaryButton title={busy ? 'Saving…' : 'Save Changes'} onPress={handleSave} disabled={busy || !name.trim()} />
    </Shell>
  );
}

export function ListenerActionModal({
  visible,
  listener,
  isHostViewer,
  onClose,
  onMention,
  onTransferHost,
  onKickListener,
  onViewProfile,
}: {
  visible: boolean;
  listener: { user_id: string; user_name: string; avatar_url?: string | null; is_host?: boolean } | null;
  isHostViewer?: boolean;
  onClose: () => void;
  onMention?: (userName: string) => void;
  onTransferHost?: (userId: string, userName: string) => void;
  onKickListener?: (userId: string, userName: string) => void;
  onViewProfile?: (userId: string) => void;
}) {
  if (!listener) return null;
  const initialsText = (listener.user_name || '?').slice(0, 2).toUpperCase();

  return (
    <Shell visible={visible} onClose={onClose}>
      <View style={{ alignItems: 'center' }}>
        {listener.avatar_url ? (
          <Image source={{ uri: listener.avatar_url }} style={styles.listenerModalAvatar} />
        ) : (
          <View style={[styles.avatarPreview, { backgroundColor: colors.amber }]}>
            <Text style={styles.avatarPreviewText}>{initialsText}</Text>
          </View>
        )}
        <Title style={{ textAlign: 'center', marginTop: 8 }}>{listener.user_name}</Title>
        <Text style={styles.listenerModalRole}>
          {listener.is_host ? 'Host & DJ' : 'Active Listener'}
        </Text>
      </View>

      <View style={styles.gap} />

      {onViewProfile ? (
        <Pressable
          onPress={() => {
            onViewProfile(listener.user_id);
            onClose();
          }}
          style={({ pressed }) => [styles.actionButtonSecondary, pressed && styles.pressed]}
        >
          <User size={16} color={colors.amber} />
          <Text style={styles.actionButtonSecondaryText}>View Public Profile</Text>
        </Pressable>
      ) : null}

      {onMention ? (
        <Pressable
          onPress={() => {
            onMention(listener.user_name);
            onClose();
          }}
          style={({ pressed }) => [styles.actionButtonSecondary, { marginTop: 8 }, pressed && styles.pressed]}
        >
          <MessageSquare size={16} color={colors.text1} />
          <Text style={styles.actionButtonSecondaryText}>Mention in Chat</Text>
        </Pressable>
      ) : null}

      {isHostViewer && !listener.is_host && onTransferHost ? (
        <Pressable
          onPress={() => {
            onTransferHost(listener.user_id, listener.user_name);
            onClose();
          }}
          style={({ pressed }) => [
            styles.actionButtonSecondary,
            { marginTop: 8, borderColor: 'rgba(255, 159, 28, 0.3)' },
            pressed && styles.pressed,
          ]}
        >
          <Crown size={16} color={colors.amber} />
          <Text style={[styles.actionButtonSecondaryText, { color: colors.amber }]}>
            Make Room Host
          </Text>
        </Pressable>
      ) : null}

      {isHostViewer && !listener.is_host && onKickListener ? (
        <Pressable
          onPress={() => {
            onKickListener(listener.user_id, listener.user_name);
            onClose();
          }}
          style={({ pressed }) => [styles.actionButtonDestructive, { marginTop: 8 }, pressed && styles.pressed]}
        >
          <UserX size={16} color="#ef4444" />
          <Text style={styles.actionButtonDestructiveText}>Remove from Room</Text>
        </Pressable>
      ) : null}

      <View style={{ height: 12 }} />
      <Pressable
        onPress={onClose}
        style={({ pressed }) => [styles.stayBtn, pressed && styles.pressed]}
      >
        <Text style={styles.stayBtnText}>Close</Text>
      </Pressable>
    </Shell>
  );
}

export function RoomInviteModal({
  visible,
  roomId,
  roomName,
  onClose,
  onShare,
}: {
  visible: boolean;
  roomId: string;
  roomName?: string;
  onClose: () => void;
  onShare: () => void;
}) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&format=png&data=${encodeURIComponent(
    `https://www.openjam.fun/room/${roomId}`,
  )}`;

  return (
    <Shell visible={visible} onClose={onClose}>
      <View style={{ alignItems: 'center' }}>
        <View style={styles.qrIconWrap}>
          <QrCode size={22} color={colors.amber} />
        </View>
        <Title style={{ textAlign: 'center', marginTop: 10 }}>Invite to Jam</Title>
        <Subtitle style={{ textAlign: 'center', marginTop: 4 }}>
          {roomName || 'Live Music Room'}
        </Subtitle>

        {/* QR Code Container */}
        <View style={styles.qrCodeFrame}>
          <Image
            source={{ uri: qrUrl }}
            style={styles.qrImage}
            resizeMode="contain"
          />
        </View>

        {/* Room Code Badge */}
        <View style={styles.roomCodeBadge}>
          <Text style={styles.roomCodeLabel}>ROOM CODE</Text>
          <Text style={styles.roomCodeText}>#{roomId}</Text>
        </View>
      </View>

      <View style={{ height: 16 }} />

      <PrimaryButton title="Share Invite Link" onPress={onShare} />

      <View style={{ height: 8 }} />
      <Pressable
        onPress={onClose}
        style={({ pressed }) => [styles.stayBtn, pressed && styles.pressed]}
      >
        <Text style={styles.stayBtnText}>Done</Text>
      </Pressable>
    </Shell>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: '#0d0d12',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 24,
    padding: spacing.lg,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  createModalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 159, 28, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.25)',
    borderRadius: radius.full,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    alignSelf: 'flex-start',
    marginBottom: spacing.xs + 2,
  },
  createModalBadgeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.amber,
  },
  sub: { marginTop: 4 },
  gap: { height: spacing.md },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  switchLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 15,
    color: colors.text1,
  },
  error: { fontFamily: fontFamily.bodyRegular, fontSize: 13, color: colors.red, marginTop: spacing.sm },
  avatarPreview: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: colors.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  avatarPreviewText: {
    fontFamily: fontFamily.displayBold,
    fontSize: 24,
    color: '#ffffff',
  },
  inputWithDice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.sm,
  },
  diceBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 159, 28, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diceText: {
    fontSize: 22,
  },
  guestNote: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  guestNoteText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text3,
  },
  closeModalBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeModalText: {
    color: colors.text3,
    fontSize: 12,
  },
  discordLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#5865F2',
    height: 48,
    borderRadius: radius.md,
    marginTop: spacing.md,
    shadowColor: '#5865F2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  discordIconText: {
    fontSize: 18,
  },
  discordLoginBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 15,
    color: '#ffffff',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dividerText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.text3,
    marginHorizontal: spacing.sm,
  },
  discordAvatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#5865F2',
    marginBottom: spacing.xs,
  },
  discordTag: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 14,
    color: '#5865F2',
    marginTop: 2,
  },
  discordBadgeRow: {
    marginTop: spacing.sm,
    backgroundColor: 'rgba(88, 101, 242, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(88, 101, 242, 0.3)',
  },
  discordBadgeText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    color: '#a5b4fc',
  },
  signOutBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14,
    color: '#ef4444',
  },
  tagSectionLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: colors.text2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 8,
  },
  tagChipsPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  pickerChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pickerChipActive: {
    backgroundColor: 'rgba(255, 159, 28, 0.2)',
    borderColor: colors.amber,
  },
  pickerChipText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text3,
  },
  pickerChipTextActive: {
    fontFamily: fontFamily.bodySemiBold,
    color: colors.amber,
  },
  leaveIconWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  leaveBtnRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  stayBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stayBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14,
    color: colors.text1,
  },
  confirmLeaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmLeaveText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14,
    color: colors.red,
  },
  pressed: {
    opacity: 0.8,
  },
  welcomeScrollContent: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  welcomeHeroWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  welcomeEmblemAura: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(255, 159, 28, 0.16)',
    shadowColor: colors.amber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 22,
    elevation: 6,
  },
  welcomeEmblemWrap: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: 'rgba(18, 18, 26, 0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 159, 28, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeEmblem: {
    width: 70,
    height: 70,
  },
  welcomeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 159, 28, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.25)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    marginTop: 8,
    marginBottom: 6,
  },
  welcomeBadgeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 9.5,
    letterSpacing: 1.1,
    color: colors.amber,
  },
  welcomeTitle: {
    textAlign: 'center',
    fontSize: 22,
    color: '#ffffff',
    letterSpacing: -0.4,
  },
  welcomeSubtitle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 14,
    color: colors.text2,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  authErrorCard: {
    width: '100%',
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.35)',
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  authErrorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  authErrorTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12.5,
    color: colors.red,
  },
  authErrorDesc: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11.5,
    color: '#fecdd3',
    lineHeight: 16,
  },
  discordActionWrap: {
    width: '100%',
  },
  welcomeDividerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  welcomeDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  welcomeDividerText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.text3,
    marginHorizontal: spacing.md,
  },
  guestActionWrap: {
    width: '100%',
  },
  browseWithoutSignInBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  browseWithoutSignInText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12.5,
    color: colors.text3,
  },
  listenerModalAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.amber,
    marginBottom: spacing.xs,
  },
  listenerModalRole: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    color: colors.text2,
    marginTop: 2,
  },
  actionButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  actionButtonSecondaryText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14,
    color: colors.text1,
  },
  switchDesc: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text3,
    marginTop: 2,
  },
  actionButtonDestructive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  actionButtonDestructiveText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14,
    color: '#ef4444',
  },
  qrIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCodeFrame: {
    width: 200,
    height: 200,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 10,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 159, 28, 0.4)',
  },
  qrImage: {
    width: '100%',
    height: '100%',
  },
  roomCodeBadge: {
    alignItems: 'center',
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  roomCodeLabel: {
    fontFamily: fontFamily.displayBold,
    fontSize: 9,
    color: colors.text3,
    letterSpacing: 1,
  },
  roomCodeText: {
    fontFamily: fontFamily.displayBold,
    fontSize: 16,
    color: colors.amber,
    marginTop: 1,
  },
});
