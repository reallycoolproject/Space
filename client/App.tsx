import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

const palette = {
  canvas: '#0E1531',
  surface: '#21304D',
  primary: '#2962FF',
  accent: '#CCFF58',
  white: '#F8FAFF',
  muted: '#9EB0C8',
  border: 'rgba(255,255,255,0.16)',
};

const AppShell = () => {
  const float = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const panel = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const floatAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: -8,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 8,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const glowAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const panelAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(panel, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(panel, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    floatAnim.start();
    glowAnim.start();
    panelAnim.start();

    return () => {
      floatAnim.stop();
      glowAnim.stop();
      panelAnim.stop();
    };
  }, [float, glow, panel]);

  const orbOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 0.45],
  });

  const orbScale = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.04],
  });

  const panelRotate = panel.interpolate({
    inputRange: [0, 1],
    outputRange: ['-1deg', '1deg'],
  });

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Animated.View
        style={[
          styles.orb,
          styles.orbOne,
          {
            opacity: orbOpacity,
            transform: [{ translateY: float }, { scale: orbScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.orb,
          styles.orbTwo,
          {
            opacity: orbOpacity,
            transform: [{ translateY: float }, { scale: orbScale }],
          },
        ]}
      />

      <View style={styles.shell}>
        <View style={styles.navBar}>
          <View style={styles.brandWrap}>
            <Text style={styles.brand}>Space</Text>
            <Text style={styles.brandTag}>private social • premium by default</Text>
          </View>
          <View style={styles.navActions}>
            <Pressable style={styles.navButtonSecondary}>
              <Text style={styles.navButtonText}>Log in</Text>
            </Pressable>
            <Pressable style={styles.navButtonPrimary}>
              <Text style={styles.navButtonText}>Sign up</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.heroRow}>
          <View style={styles.heroCopy}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>Private social • encrypted by design</Text>
            </View>

            <Text style={styles.heroTitle}>
              Give your privacy some{' '}
              <Text style={styles.heroAccent}>Space</Text>
            </Text>

            <Text style={styles.heroSubtitle}>
              A premium community OS for private conversations, calm collaboration, and deeply polished digital rituals.
            </Text>

            <View style={styles.ctaRow}>
              <Pressable style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Open Space</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Explore features</Text>
              </Pressable>
            </View>

            <View style={styles.featureRow}>
              <View style={styles.featureCard}>
                <Text style={styles.featureTitle}>Encrypted rooms</Text>
                <Text style={styles.featureText}>Secure chats with privacy-first defaults.</Text>
              </View>
              <View style={styles.featureCard}>
                <Text style={styles.featureTitle}>Voice & vibe</Text>
                <Text style={styles.featureText}>Premium audio and clear, calm spaces.</Text>
              </View>
              <View style={styles.featureCard}>
                <Text style={styles.featureTitle}>Intuitive channels</Text>
                <Text style={styles.featureText}>Organized flows that feel effortless.</Text>
              </View>
              <View style={styles.featureCard}>
                <Text style={styles.featureTitle}>Design-forward</Text>
                <Text style={styles.featureText}>Beautiful, glassy, and deeply tactile.</Text>
              </View>
            </View>
          </View>

          <Animated.View style={[styles.previewCard, { transform: [{ translateY: float }, { rotate: panelRotate }] }]}>
            <View style={styles.previewGlow} />
            <Text style={styles.previewBadge}>Secure by design</Text>
            <Text style={styles.previewTitle}>The most beautiful private home for your people.</Text>
            <Text style={styles.previewText}>
              Build communities that feel effortless, elegant, and truly yours.
            </Text>

            <View style={styles.mockPanel}>
              <View style={styles.mockRow}>
                <View style={styles.mockDot} />
                <Text style={styles.mockLabel}># private-lounge</Text>
              </View>
              <Text style={styles.mockMessage}>A calm place for thoughtful conversation.</Text>
            </View>

            <View style={styles.statRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>24/7</Text>
                <Text style={styles.statLabel}>Always online</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>∞</Text>
                <Text style={styles.statLabel}>Flexible spaces</Text>
              </View>
            </View>
          </Animated.View>
        </View>
      </View>
    </View>
  );
};

export default function App() {
  return <AppShell />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.canvas,
    padding: 20,
    justifyContent: 'center',
  },
  shell: {
    flex: 1,
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.32,
    shadowRadius: 40,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbOne: {
    width: 280,
    height: 280,
    backgroundColor: 'rgba(41,98,255,0.24)',
    top: -40,
    left: -60,
  },
  orbTwo: {
    width: 340,
    height: 340,
    backgroundColor: 'rgba(204,255,88,0.16)',
    bottom: -90,
    right: -80,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  brandWrap: {
    flexDirection: 'column',
  },
  brand: {
    color: palette.white,
    fontSize: 36,
    fontWeight: '900',
    fontFamily: 'Georgia',
    textDecorationLine: 'underline',
    letterSpacing: 1.2,
  },
  brandTag: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 4,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  navActions: {
    flexDirection: 'row',
  },
  navButtonSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    marginRight: 10,
  },
  navButtonPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 999,
    backgroundColor: palette.primary,
  },
  navButtonText: {
    color: palette.white,
    fontSize: 13,
    fontWeight: '700',
  },
  heroRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroCopy: {
    flex: 1,
    paddingRight: 24,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(204,255,88,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(204,255,88,0.24)',
    marginBottom: 18,
  },
  pillText: {
    color: palette.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: palette.white,
    fontSize: 44,
    fontWeight: '900',
    lineHeight: 50,
    marginBottom: 14,
  },
  heroAccent: {
    color: palette.accent,
    fontFamily: 'Georgia',
    textDecorationLine: 'underline',
  },
  heroSubtitle: {
    color: palette.muted,
    fontSize: 18,
    lineHeight: 28,
    maxWidth: 620,
    marginBottom: 24,
  },
  ctaRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  primaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: palette.primary,
    marginRight: 12,
  },
  primaryButtonText: {
    color: palette.white,
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  secondaryButtonText: {
    color: palette.white,
    fontSize: 15,
    fontWeight: '700',
  },
  featureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  featureCard: {
    flexBasis: '48%',
    marginRight: '2%',
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 12,
  },
  featureTitle: {
    color: palette.white,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  featureText: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  previewCard: {
    width: 360,
    padding: 22,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
  },
  previewGlow: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(41,98,255,0.14)',
    borderRadius: 28,
  },
  previewBadge: {
    color: palette.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  previewTitle: {
    color: palette.white,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    marginBottom: 10,
  },
  previewText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 18,
  },
  mockPanel: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: 'rgba(9,14,30,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 14,
  },
  mockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  mockDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.primary,
    marginRight: 8,
  },
  mockLabel: {
    color: palette.white,
    fontSize: 13,
    fontWeight: '700',
  },
  mockMessage: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  statRow: {
    flexDirection: 'row',
  },
  statBox: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginRight: 10,
  },
  statValue: {
    color: palette.white,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    color: palette.muted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
