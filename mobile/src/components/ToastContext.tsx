/**
 * Toast notification system — glassmorphic floating toasts matching the PWA's
 * `.toast-stack` pattern. Supports success / error / warning / info types.
 *
 * Usage:
 *   const toast = useToast();
 *   toast('Track added to queue');                    // default info
 *   toast('Connection lost', 'error');                // error toast
 *   toast('You are now the host!', 'success');        // success toast
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
} from 'react-native-reanimated';
import { Info, Check, X, AlertTriangle } from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { fontFamily } from '../fonts';

export type ToastType = 'info' | 'success' | 'error' | 'warning';

interface ToastItem {
  id: string;
  text: string;
  type: ToastType;
}

type ToastFn = (text: string, type?: ToastType, durationMs?: number) => void;

const ToastCtx = createContext<ToastFn>(() => {});

function ToastIcon({ type }: { type: ToastType }) {
  const color = ACCENT[type];
  switch (type) {
    case 'success':
      return <Check size={14} color={color} strokeWidth={2.8} />;
    case 'error':
      return <X size={14} color={color} strokeWidth={2.8} />;
    case 'warning':
      return <AlertTriangle size={14} color={color} strokeWidth={2.5} />;
    default:
      return <Info size={14} color={color} strokeWidth={2.5} />;
  }
}

const ACCENT: Record<ToastType, string> = {
  info: '#29b6f6',
  success: colors.green,
  error: colors.red,
  warning: colors.amber,
};

const BORDER: Record<ToastType, string> = {
  info: 'rgba(41, 182, 246, 0.25)',
  success: 'rgba(16, 185, 129, 0.25)',
  error: 'rgba(244, 63, 94, 0.25)',
  warning: 'rgba(255, 159, 28, 0.25)',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const show: ToastFn = useCallback((text, type = 'info', durationMs = 3000) => {
    const id = `toast-${++counter.current}`;
    setToasts((prev) => [...prev.slice(-4), { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, durationMs);
  }, []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toasts.length > 0 && (
        <View style={styles.stack} pointerEvents="none">
          {toasts.map((t) => (
            <Animated.View
              key={t.id}
              entering={SlideInDown.duration(300).easing(Easing.out(Easing.back(1.5)))}
              exiting={FadeOut.duration(200)}
              style={[styles.toast, { borderColor: BORDER[t.type] }]}
            >
              <View style={[styles.iconWrap, { backgroundColor: ACCENT[t.type] + '22' }]}>
                <ToastIcon type={t.type} />
              </View>
              <Text style={styles.text} numberOfLines={2}>
                {t.text}
              </Text>
            </Animated.View>
          ))}
        </View>
      )}
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastFn {
  return useContext(ToastCtx);
}

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    bottom: 100,
    left: spacing.md,
    right: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 15, 20, 0.92)',
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    maxWidth: 380,
    width: '100%',
    // glassmorphism shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 8,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 14, fontWeight: '700' },
  text: {
    flex: 1,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 14,
    color: colors.text1,
  },
});
