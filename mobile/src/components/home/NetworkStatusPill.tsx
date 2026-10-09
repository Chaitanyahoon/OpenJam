import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WifiOff, CheckCircle2 } from 'lucide-react-native';
import { radius } from '../../theme';
import { fontFamily } from '../../fonts';

export interface NetworkStatusPillProps {
  isOnline: boolean;
  showReconnected: boolean;
}

export const NetworkStatusPill: React.FC<NetworkStatusPillProps> = ({
  isOnline,
  showReconnected,
}) => {
  if (!isOnline) {
    return (
      <View style={styles.networkStatusPillOffline}>
        <WifiOff size={13} color="#f59e0b" strokeWidth={2.4} />
        <Text style={styles.networkStatusTextOffline}>
          Offline Mode • Playing Saved Vault Music
        </Text>
      </View>
    );
  }

  if (showReconnected) {
    return (
      <View style={styles.networkStatusPillOnline}>
        <CheckCircle2 size={13} color="#10b981" strokeWidth={2.4} />
        <Text style={styles.networkStatusTextOnline}>
          Back Online • Live Rooms Synced
        </Text>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  networkStatusPillOffline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.28)',
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'center',
    marginBottom: 8,
  },
  networkStatusTextOffline: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11.5,
    color: '#f59e0b',
  },
  networkStatusPillOnline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.28)',
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'center',
    marginBottom: 8,
  },
  networkStatusTextOnline: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11.5,
    color: '#10b981',
  },
});
