/**
 * Terms of Service Screen.
 * Mobile Android client for OpenJam.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, FileText } from 'lucide-react-native';
import { colors, radius, spacing } from '../../theme';
import { fontFamily } from '../../fonts';

export default function TermsOfServiceScreen() {
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
        <Text style={styles.barTitle}>Terms of Service</Text>
        <View style={styles.placeholderBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.badgeRow}>
          <FileText size={16} color={colors.amber} />
          <Text style={styles.badgeText}>USER AGREEMENT & TERMS</Text>
        </View>

        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.updatedDate}>Last updated: October 2026</Text>

        <View style={styles.section}>
          <Text style={styles.paragraph}>
            By accessing or using the OpenJam application, you agree to comply with and be bound by these Terms of Service. If you disagree with any part of these terms, please discontinue using the service.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>1. Service Description</Text>
          <Text style={styles.paragraph}>
            OpenJam is an open-source real-time listening platform where users can create synchronized music rooms, queue audio tracks, and interact with fellow listeners. Audio streams are resolved and played via standard internet protocols and public web media.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>2. Acceptable Community Conduct</Text>
          <Text style={styles.paragraph}>
            OpenJam is designed for friendly, harmonious music listening. You agree not to:
          </Text>
          <View style={styles.bulletItem}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              Harass, impersonate, or abuse other listeners in room chats or community lounges.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              Queue spam, malicious audio scripts, or prohibited content.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              Circumvent room permissions, host controls, or password protections.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>3. Audio & Intellectual Property</Text>
          <Text style={styles.paragraph}>
            OpenJam does not host, distribute, or claim ownership of any copyrighted audio recordings. All songs and videos streamed remain the intellectual property of their respective creators, publishers, and copyright owners.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>4. Open Source Licensing</Text>
          <Text style={styles.paragraph}>
            The OpenJam client application and server code are provided under the permissive MIT Open Source License. You are welcome to review, audit, and contribute to the code on GitHub.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>5. Limitation of Liability</Text>
          <Text style={styles.paragraph}>
            The application is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind. OpenJam and its community maintainers shall not be liable for any temporary outages or service interruptions.
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
});
