/** Create / Join / Leave modals — glassmorphic, per the web app's modals/. */
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { fontFamily } from '../fonts';
import { Field, PrimaryButton, Title, Subtitle } from './ui';
import { createRoom } from '../api';

function Shell({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const room = await createRoom({
        name: name.trim(),
        password: password,
        is_private: isPrivate,
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
      <Title>Create a room</Title>
      <Subtitle style={styles.sub}>Name it, lock it, jam.</Subtitle>
      <View style={styles.gap} />
      <Field value={name} onChangeText={setName} placeholder="Room name" />
      <View style={styles.gap} />
      <Field
        value={password}
        onChangeText={setPassword}
        placeholder="Password (optional)"
        secureTextEntry
        autoCapitalize="none"
      />
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Private room</Text>
        <Switch
          value={isPrivate}
          onValueChange={setIsPrivate}
          trackColor={{ true: colors.amber, false: colors.bgSurface }}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.gap} />
      <PrimaryButton title={busy ? 'Creating…' : 'Create & Join'} onPress={submit} disabled={busy} />
    </Shell>
  );
}

export function IdentityModal({
  visible,
  onDone,
}: {
  visible: boolean;
  onDone: (displayName: string) => void;
}) {
  const [name, setName] = useState('');
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Title>Welcome to OpenJam</Title>
          <Subtitle style={styles.sub}>Pick a display name to start jamming.</Subtitle>
          <View style={styles.gap} />
          <Field
            value={name}
            onChangeText={setName}
            placeholder="Display name"
            onSubmitEditing={() => name.trim() && onDone(name.trim())}
          />
          <View style={styles.gap} />
          <PrimaryButton
            title="Start jamming"
            onPress={() => name.trim() && onDone(name.trim())}
            disabled={!name.trim()}
          />
        </View>
      </View>
    </Modal>
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
      <Title>Leave room?</Title>
      <Subtitle style={styles.sub}>
        You&apos;ll stop hearing the music. You can rejoin anytime.
      </Subtitle>
      <View style={styles.gap} />
      <PrimaryButton title="Leave" danger onPress={onConfirm} />
      <View style={styles.gap} />
      <PrimaryButton title="Stay" onPress={onClose} />
    </Shell>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderAmber,
    borderRadius: radius.lg,
    padding: spacing.lg,
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
});
