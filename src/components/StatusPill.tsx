import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export type StatusPillVariant =
  | 'respond'
  | 'comingSoon'
  | 'expired'
  | 'inProgress'
  | 'questionnaireOpen'
  | 'completed'
  | 'cooldown'
  | 'default';

interface StatusPillProps {
  variant: StatusPillVariant;
  onPress?: () => void;
  showNotificationDot?: boolean;
  testID?: string;
}

/**
 * StatusPill - Unified status badge component
 * 
 * Handles all training status variants with consistent styling:
 * - respond: Blue gradient CTA button (clickable)
 * - comingSoon: Cyan badge with hourglass icon
 * - expired: Dark badge with lock icon
 * - inProgress: Badge indicating ongoing training
 * - questionnaireOpen: Alias for respond
 * - completed: Green badge with checkmark
 * - cooldown: Cooldown period badge
 * - default: Fallback styling
 */
export default function StatusPill({
  variant,
  onPress,
  showNotificationDot = false,
  testID,
}: StatusPillProps) {
  const isClickable = variant === 'respond' || variant === 'questionnaireOpen';
  const isDisabled = !isClickable;

  // Icon and label configuration
  const getConfig = () => {
    switch (variant) {
      case 'respond':
      case 'questionnaireOpen':
        return {
          icon: '', // No icon for respond variant
          label: 'Respond',
          iconColor: '#FFFFFF',
          textColor: '#FFFFFF',
          fontWeight: '600' as const,
          showIcon: false,
        };
      case 'comingSoon':
        return {
          icon: '⏳',
          label: 'Coming soon',
          iconColor: '#8DEBFF',
          textColor: '#DFF8FF',
          fontWeight: '500' as const,
          showIcon: true,
        };
      case 'expired':
        return {
          icon: '🔒',
          label: 'Expired',
          iconColor: '#9CA3AF',
          textColor: '#9CA3AF',
          fontWeight: '500' as const,
          showIcon: true,
        };
      case 'completed':
        return {
          icon: '',
          label: 'Completed',
          iconColor: '#FFFFFF',
          textColor: '#FFFFFF',
          fontWeight: '600' as const,
          showIcon: true,
        };
      case 'inProgress':
        return {
          icon: '▶️',
          label: 'In progress',
          iconColor: '#BFC7FF',
          textColor: '#BFC7FF',
          fontWeight: '500' as const,
          showIcon: true,
        };
      case 'cooldown':
        return {
          icon: '⏳',
          label: 'Coming soon',
          iconColor: '#8DEBFF',
          textColor: '#DFF8FF',
          fontWeight: '500' as const,
          showIcon: true,
        };
      default:
        return {
          icon: '',
          label: 'Unknown',
          iconColor: '#9CA3AF',
          textColor: '#9CA3AF',
          fontWeight: '500' as const,
          showIcon: false,
        };
    }
  };

  const config = getConfig();

  if (Platform.OS === 'web') {
    const isRespond = variant === 'respond' || variant === 'questionnaireOpen';
    const isCompleted = variant === 'completed';

    // Respond variant with gradient - matches Coming Soon style exactly
    if (isRespond) {
      return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button
            onClick={onPress}
            disabled={!onPress}
            data-testid={testID}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '36px',
              padding: '0 16px',
              borderRadius: '12px',
              background: 'linear-gradient(120deg, #00F5FF 0%, #00A8FF 40%, #4A67FF 100%)',
              border: 'none',
              boxShadow:
                '0 10px 25px rgba(6, 16, 42, 0.65), 0 0 25px rgba(0, 245, 255, 0.45), inset 0 0 14px rgba(0, 224, 255, 0.25)',
              color: config.textColor,
              fontFamily: "'Inter', sans-serif",
              fontSize: '14px',
              fontWeight: config.fontWeight,
              letterSpacing: '0.03em',
              cursor: onPress ? 'pointer' : 'not-allowed',
              transition: 'all 0.12s ease',
              position: 'relative',
              opacity: onPress ? 1 : 0.6,
            }}
            onMouseDown={(e) => {
              if (onPress) {
                e.currentTarget.style.transform = 'scale(0.98)';
              }
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <span>{config.label}</span>
          </button>
          {/* Red notification dot - vivid red with shine, overlapping corner */}
          {showNotificationDot && (
            <div
              style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: '#FF003C',
                boxShadow:
                  '0 0 16px rgba(255, 51, 102, 0.95), 0 0 24px rgba(255, 51, 102, 0.75), 0 6px 10px rgba(0, 0, 0, 0.45)',
                zIndex: 10,
                filter: 'drop-shadow(0 0 6px rgba(255, 51, 102, 0.7))',
              }}
            />
          )}
        </div>
      );
    }

    const renderWebIcon = () => {
      if (isCompleted) {
        return (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 0 10px rgba(0, 255, 194, 0.4), inset 0 0 6px rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          >
            <svg
              width="6"
              height="5"
              viewBox="0 0 10 8"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ filter: 'drop-shadow(0 0 3px rgba(0, 255, 194, 0.6))' }}
            >
              <path
                d="M1 4L4 7L9 1"
                stroke="#000000"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        );
      }

      if (config.showIcon) {
        return (
          <span
            style={{
              color: config.iconColor,
              textShadow:
                variant === 'comingSoon' || variant === 'cooldown'
                  ? '0 0 8px rgba(0, 224, 255, 0.8)'
                  : 'none',
            }}
          >
            {config.icon}
          </span>
        );
      }

      return null;
    };

    // Completed variant with gradient - matches Respond style
    if (isCompleted) {
      return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              height: '36px',
              padding: '0 16px',
              borderRadius: '12px',
              background: 'linear-gradient(120deg, #00FFC2 0%, #00C16A 100%)',
              border: 'none',
              boxShadow:
                '0 10px 25px rgba(6, 16, 42, 0.65), 0 0 25px rgba(0, 255, 194, 0.45), inset 0 0 14px rgba(0, 193, 106, 0.25)',
              color: '#FFFFFF',
              fontFamily: "'Inter', sans-serif",
              fontSize: '14px',
              fontWeight: '600',
              letterSpacing: '0.03em',
              cursor: 'not-allowed',
              userSelect: 'none',
              position: 'relative',
            }}
            data-testid={testID}
          >
            {renderWebIcon()}
            <span>{config.label}</span>
          </div>
          {showNotificationDot && (
            <div
              style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: '#FF003C',
                boxShadow:
                  '0 0 16px rgba(255, 51, 102, 0.95), 0 0 24px rgba(255, 51, 102, 0.75), 0 6px 10px rgba(0, 0, 0, 0.45)',
                zIndex: 10,
                filter: 'drop-shadow(0 0 6px rgba(255, 51, 102, 0.7))',
              }}
            />
          )}
        </div>
      );
    }

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          height: '36px',
          padding: '0 16px',
          borderRadius: '12px',
          backgroundColor:
            variant === 'comingSoon' || variant === 'cooldown'
              ? 'rgba(0, 224, 255, 0.12)'
              : variant === 'inProgress'
              ? 'rgba(74, 103, 255, 0.2)'
              : variant === 'expired'
              ? '#1A1A1A'
              : 'rgba(0, 224, 255, 0.12)',
          border:
            variant === 'comingSoon' || variant === 'cooldown'
              ? '0.5px solid rgba(0, 224, 255, 0.45)'
              : variant === 'inProgress'
              ? '0.5px solid rgba(74, 103, 255, 0.4)'
              : 'none',
          boxShadow:
            variant === 'comingSoon' || variant === 'cooldown'
              ? '0 0 18px rgba(0, 224, 255, 0.25), inset 0 0 12px rgba(0, 224, 255, 0.15)'
              : variant === 'inProgress'
              ? '0 0 12px rgba(74, 103, 255, 0.3)'
              : 'none',
          color: config.textColor,
          fontFamily: "'Inter', sans-serif",
          fontSize: '14px',
          fontWeight: config.fontWeight,
          letterSpacing: '0.03em',
          cursor: 'not-allowed',
          userSelect: 'none',
          position: 'relative',
        }}
        data-testid={testID}
      >
        {renderWebIcon()}
        <span>{config.label}</span>
        {showNotificationDot && (
          <div
            style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: '#FF003C',
              boxShadow:
                '0 0 16px rgba(255, 51, 102, 0.95), 0 0 24px rgba(255, 51, 102, 0.75), 0 6px 10px rgba(0, 0, 0, 0.45)',
              zIndex: 10,
              filter: 'drop-shadow(0 0 6px rgba(255, 51, 102, 0.7))',
            }}
          />
        )}
      </div>
    );
  }

  // React Native version
  if (isRespond) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#00F5FF', '#00A8FF', '#4A67FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.respondGradient}
        >
          <Pressable
            onPress={onPress}
            disabled={!onPress}
            testID={testID}
            style={({ pressed }) => [
              styles.pressable,
              pressed && styles.pressablePressed,
            ]}
          >
            <Text style={[styles.label, { color: config.textColor, fontWeight: config.fontWeight }]}>
              {config.label}
            </Text>
          </Pressable>
        </LinearGradient>
        {/* Red notification dot - vivid red with shine, no internal shapes */}
        {showNotificationDot && <View style={styles.notificationDot} />}
      </View>
    );
  }

  // Completed variant with gradient - matches Respond style
  if (variant === 'completed') {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#00FFC2', '#00C16A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.completedGradient}
        >
          <View style={styles.content}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.2)',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#00FFC2',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.4,
                shadowRadius: 10,
                elevation: 8,
              }}
            >
              <Text
                style={{
                  color: '#000000',
                  fontSize: 9,
                  fontWeight: '900',
                  textShadowColor: 'rgba(0, 0, 0, 0.3)',
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 1,
                }}
              >
                ✓
              </Text>
            </View>
            <Text style={[styles.label, { color: '#FFFFFF', fontWeight: '600', letterSpacing: 0.03 }]}>
              {config.label}
            </Text>
          </View>
        </LinearGradient>
        {showNotificationDot && <View style={styles.notificationDot} />}
      </View>
    );
  }

  // Other variants
  const getBackgroundStyle = () => {
    switch (variant) {
      case 'completed':
        return styles.completedBackground;
      case 'comingSoon':
      case 'cooldown':
        return styles.comingSoonBackground;
      case 'inProgress':
        return styles.inProgressBackground;
      case 'expired':
        return styles.expiredBackground;
      default:
        return styles.defaultBackground;
    }
  };

  const getBorderStyle = () => {
    switch (variant) {
      case 'completed':
        return styles.completedBorder;
      case 'comingSoon':
      case 'cooldown':
        return styles.comingSoonBorder;
      case 'inProgress':
        return styles.inProgressBorder;
      default:
        return {};
    }
  };

  const getShadowStyle = () => {
    switch (variant) {
      case 'completed':
        return styles.completedShadow;
      case 'comingSoon':
      case 'cooldown':
        return styles.comingSoonShadow;
      case 'inProgress':
        return styles.inProgressShadow;
      default:
        return {};
    }
  };

  return (
    <View style={[styles.container, getBackgroundStyle(), getBorderStyle(), getShadowStyle()]}>
      <View style={styles.content}>
        {config.showIcon && (
          <Text
            style={[
              styles.icon,
              {
                color: config.iconColor,
                textShadowColor:
                  variant === 'comingSoon' ? 'rgba(0, 224, 255, 0.8)' : 'transparent',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 8,
              },
            ]}
          >
            {config.icon}
          </Text>
        )}
        <Text style={[styles.label, { color: config.textColor, fontWeight: config.fontWeight }]}>
          {config.label}
        </Text>
      </View>
      {/* Red notification dot - positioned inside pill (top-right) */}
      {showNotificationDot && <View style={styles.notificationDot} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 12,
    overflow: 'visible',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pressable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pressablePressed: {
    opacity: 0.9,
  },
  respondGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 12,
    borderWidth: 0,
    borderColor: 'transparent',
    shadowColor: '#00F5FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
  },
  completedGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 12,
    borderWidth: 0,
    borderColor: 'transparent',
    shadowColor: '#00FFC2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
  },
  completedIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00FFC2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    shadowColor: '#00FFC2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  completedIconCheck: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  completedLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: 0.04,
  },
  icon: {
    fontSize: 14,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter',
    letterSpacing: 0.03,
  },
  // Background styles
  completedBackground: {
    backgroundColor: 'rgba(0, 255, 200, 0.15)',
  },
  comingSoonBackground: {
    backgroundColor: 'rgba(0, 224, 255, 0.12)',
  },
  inProgressBackground: {
    backgroundColor: 'rgba(74, 103, 255, 0.2)',
  },
  expiredBackground: {
    backgroundColor: '#1A1A1A',
  },
  defaultBackground: {
    backgroundColor: 'rgba(0, 224, 255, 0.12)',
  },
  // Border styles
  completedBorder: {
    borderWidth: 0.5,
    borderColor: 'rgba(0, 255, 200, 0.4)',
  },
  comingSoonBorder: {
    borderWidth: 0.5,
    borderColor: 'rgba(0, 224, 255, 0.45)',
  },
  inProgressBorder: {
    borderWidth: 0.5,
    borderColor: 'rgba(74, 103, 255, 0.4)',
  },
  // Shadow styles
  completedShadow: {
    shadowColor: '#00FFC8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  comingSoonShadow: {
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  inProgressShadow: {
    shadowColor: '#4A67FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  // Notification dot - vivid red with shine, overlapping corner
  notificationDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF003C',
    shadowColor: '#FF003C',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 18,
    borderWidth: 0,
  },
});

