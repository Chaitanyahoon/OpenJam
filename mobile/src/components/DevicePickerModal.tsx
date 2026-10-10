/**
 * Audio Device Output Switcher Modal (Spotify Connect style).
 *
 * Allows switching listening output between:
 * - Phone Speaker (Built-in)
 * - Bluetooth Audio (Wireless headphones / speaker) with direct system shortcut
 * - Wired Earphones / AUX (3.5mm / Type-C)
 * - OpenJam Collaborative Jam Room
 */
import React from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Smartphone,
  Headphones,
  Radio,
  Check,
  ExternalLink,
  X,
  Volume2,
} from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { fontFamily } from '../fonts';
import { hapticLight, hapticMedium } from '../utils/haptics';
import type { AudioDeviceRoute } from '../audio/PlayerContext';

interface DevicePickerModalProps {
  visible: boolean;
  onClose: () => void;
  activeDevice: AudioDeviceRoute;
  onSelectDevice: (device: AudioDeviceRoute) => void;
  roomName?: string | null;
}

export function DevicePickerModal({
  visible,
  onClose,
  activeDevice,
  onSelectDevice,
  roomName,
}: DevicePickerModalProps) {
  const insets = useSafeAreaInsets();

  const handleOpenBluetoothSettings = async () => {
    void hapticMedium();
    if (Platform.OS === 'android') {
      try {
        await Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS');
      } catch {
        await Linking.openSettings().catch(() => {});
      }
    } else {
      await Linking.openSettings().catch(() => {});
    }
  };

  const devices: Array<{
    id: AudioDeviceRoute;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    action?: { label: string; onPress: () => void };
  }> = [
    {
      id: 'speaker',
      title: 'Phone Speaker',
      subtitle: 'This phone • Internal speaker',
      icon: <Smartphone size={22} color={activeDevice === 'speaker' ? '#10b981' : colors.text2} />,
    },
    {
      id: 'bluetooth',
      title: 'Bluetooth Audio',
      subtitle: 'Wireless headphones, earbuds, car audio',
      icon: <Headphones size={22} color={activeDevice === 'bluetooth' ? '#10b981' : colors.text2} />,
      action: {
        label: 'Pair / Settings',
        onPress: handleOpenBluetoothSettings,
      },
    },
    {
      id: 'wired',
      title: 'Wired Headphones / AUX',
      subtitle: 'Connected via 3.5mm jack or Type-C adapter',
      icon: <Volume2 size={22} color={activeDevice === 'wired' ? '#10b981' : colors.text2} />,
    },
    {
      id: 'room',
      title: roomName ? `Jam: ${roomName}` : 'Collaborative Jam Room',
      subtitle: 'Synchronized live stream with friends',
      icon: <Radio size={22} color={activeDevice === 'room' ? '#10b981' : colors.text2} />,
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 20) + 12 },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Sheet Handlebar */}
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Listening On</Text>
              <Text style={styles.subtitle}>Select output device or connect via Bluetooth</Text>
            </View>
            <Pressable
              onPress={() => {
                void hapticLight();
                onClose();
              }}
              hitSlop={12}
              style={styles.closeBtn}
              accessibilityLabel="Close device picker"
            >
              <X size={20} color={colors.text2} />
            </Pressable>
          </View>

          {/* Device Options */}
          <View style={styles.deviceList}>
            {devices.map((d) => {
              const isSelected = activeDevice === d.id;
              return (
                <Pressable
                  key={d.id}
                  onPress={() => {
                    void hapticLight();
                    onSelectDevice(d.id);
                  }}
                  style={({ pressed }) => [
                    styles.deviceCard,
                    isSelected && styles.deviceCardActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.iconWrap, isSelected && styles.iconWrapActive]}>
                    {d.icon}
                  </View>

                  <View style={styles.deviceInfo}>
                    <Text
                      style={[
                        styles.deviceTitle,
                        isSelected && styles.deviceTitleActive,
                      ]}
                      numberOfLines={1}
                    >
                      {d.title}
                    </Text>
                    <Text style={styles.deviceSubtitle} numberOfLines={1}>
                      {d.subtitle}
                    </Text>
                  </View>

                  {d.action && (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        d.action?.onPress();
                      }}
                      hitSlop={8}
                      style={styles.actionPill}
                    >
                      <Text style={styles.actionPillText}>{d.action.label}</Text>
                      <ExternalLink size={12} color={colors.amber} />
                    </Pressable>
                  )}

                  <View
                    style={[
                      styles.radioCircle,
                      isSelected && styles.radioCircleActive,
                    ]}
                  >
                    {isSelected && <Check size={14} color="#08080a" strokeWidth={3} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#121218',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fontFamily.displayBold,
    fontSize: 18,
    color: '#ffffff',
  },
  subtitle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.text3,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  deviceList: {
    gap: 8,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 12,
  },
  deviceCardActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14,
    color: '#ffffff',
  },
  deviceTitleActive: {
    color: '#10b981',
  },
  deviceSubtitle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11.5,
    color: colors.text3,
    marginTop: 2,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.25)',
  },
  actionPillText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: colors.amber,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
});
