/**
 * Privacy Policy Screen.
 * Mobile Android client for OpenJam.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, ShieldCheck } from 'lucide-react-native';
import { colors, radius, spacing } from '../../theme';
import { fontFamily } from '../../fonts';

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          hitSlop={12}
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={22} color={colors.text1} />
        </Pressable>
        <Text style={styles.barTitle}>Privacy Policy</Text>
        <View style={styles.placeholderBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.badgeRow}>
          <ShieldCheck size={16} color={colors.amber} />
          <Text style={styles.badgeText}>DATA PROTECTION & PRIVACY</Text>
        </View>

        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.updatedDate}>Last updated: October 2026</Text>

        <View style={styles.section}>
          <Text style={styles.paragraph}>
            OpenJam (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the social music platform at https://www.openjam.fun and the OpenJam mobile application. This Privacy Policy outlines our transparent approach to user privacy and information handling.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>1. Information We Collect</Text>
          <Text style={styles.paragraph}>
            We collect minimal information necessary to deliver synchronized music listening:
          </Text>
          <View style={styles.bulletItem}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>Display Name & Identity:</Text> When joining as a guest or signing in via Discord, we store your chosen display name, Discord avatar URL, and user ID.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>Session Tokens:</Text> Authenticated session tokens are saved securely on your device using sandboxed app storage.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>Chat & Live Reactions:</Text> Ephemeral chat messages and floating reaction vibes are stored in memory and purged once the room closes.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>Device Permissions:</Text> We only request Notification permissions (for room invites/playback) and Audio foreground service permissions. We never scan private photo galleries or external files.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>2. Third-Party Integrations</Text>
          <Text style={styles.paragraph}>
            Music streams and identity services are handled through trusted integrations:
          </Text>
          <View style={styles.bulletItem}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>Discord OAuth:</Text> Used solely for user profile authentication. We do not access your Discord guilds or private messages.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>YouTube:</Text> Tracks in the queue are streamed via public web audio endpoints. Subject to Google & YouTube Privacy Policies.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>LRCLIB:</Text> Synchronized song lyrics are fetched dynamically without transmitting personally identifiable data.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>3. Offline & Sandboxed Storage</Text>
          <Text style={styles.paragraph}>
            Offline playlists and saved room bookmarks are stored strictly within the app&apos;s isolated sandbox directory. You can wipe all cached listening history at any time from the Profile preferences drawer.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>4. Contact Us</Text>
          <Text style={styles.paragraph}>
            If you have questions about privacy or wish to request data removal, reach out via our open GitHub repository or community channels.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgBase,
    overflow: 'hidden',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    backgroundColor: '#0c0c12',
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  barTitle: {
    color: colors.text1,
    fontFamily: fontFamily.displayBold,
    fontSize: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderBtn: {
    width: 36,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 48,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  badgeText: {
    color: colors.amber,
    fontFamily: fontFamily.displayBold,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  title: {
    color: colors.text1,
    fontFamily: fontFamily.displayBold,
    fontSize: 26,
    marginBottom: 4,
  },
  updatedDate: {
    color: colors.text3,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  heading: {
    color: colors.text1,
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 16,
    marginBottom: spacing.xs,
  },
  paragraph: {
    color: colors.text2,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 14,
    lineHeight: 22,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    paddingLeft: 4,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.amber,
    marginTop: 8,
    marginRight: 10,
  },
  bulletText: {
    flex: 1,
    color: colors.text2,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    lineHeight: 20,
  },
  boldText: {
    color: colors.text1,
    fontFamily: fontFamily.displaySemiBold,
  },
});
