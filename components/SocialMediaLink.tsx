import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { 
  Facebook, 
  Twitter, 
  Linkedin, 
  Instagram, 
  MessageCircle, 
  Youtube, 
  ExternalLink,
  Globe 
} from 'lucide-react-native';
import { 
  formatSocialMediaLabel, 
  getSocialMediaIcon, 
  getSocialMediaColor,
  detectSocialMediaPlatform 
} from '@/lib/socialMediaUtils';

interface SocialMediaLinkProps {
  url: string | null;
  platform: string;
  showIcon?: boolean;
  showLabel?: boolean;
  style?: any;
  textStyle?: any;
  iconSize?: number;
}

const iconComponents = {
  facebook: Facebook,
  twitter: Twitter,
  linkedin: Linkedin,
  instagram: Instagram,
  'message-circle': MessageCircle,
  youtube: Youtube,
  'external-link': ExternalLink,
  globe: Globe,
};

export default function SocialMediaLink({ 
  url, 
  platform, 
  showIcon = true, 
  showLabel = true,
  style,
  textStyle,
  iconSize = 16
}: SocialMediaLinkProps) {
  const { theme } = useTheme();

  const handlePress = async () => {
    if (!url) {
      Alert.alert('Not Available', `${platform} link not provided`);
      return;
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open this URL');
      }
    } catch (error) {
      Alert.alert('Error', `Failed to open ${platform} link`);
    }
  };

  if (!url) {
    return (
      <View style={[styles.container, style]}>
        {showIcon && (
          <View style={[styles.iconContainer, { backgroundColor: '#6b7280' + '20' }]}>
            <Globe size={iconSize} color="#6b7280" />
          </View>
        )}
        {showLabel && (
          <Text style={[
              styles.notProvidedText, 
              { color: theme.colors.textSecondary },
              textStyle
            ]} maxFontSizeMultiplier={1.3}>
            Not provided
          </Text>
        )}
      </View>
    );
  }

  const label = formatSocialMediaLabel(url);
  const iconName = getSocialMediaIcon(url);
  const brandColor = getSocialMediaColor(url);
  const IconComponent = iconComponents[iconName as keyof typeof iconComponents] || ExternalLink;

  return (
    <TouchableOpacity 
      style={[styles.linkContainer, style]} 
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {showIcon && (
        <View style={[styles.iconContainer, { backgroundColor: brandColor + '20' }]}>
          <IconComponent size={iconSize} color={brandColor} />
        </View>
      )}
      {showLabel && (
        <View style={styles.labelContainer}>
          <Text style={[
              styles.labelText, 
              { color: theme.colors.text },
              textStyle
            ]}
            numberOfLines={1}
            ellipsizeMode="tail" maxFontSizeMultiplier={1.3}>
            {label}
          </Text>
          <Text style={[
              styles.urlPreview, 
              { color: theme.colors.textSecondary }
            ]}
            numberOfLines={1}
            ellipsizeMode="middle" maxFontSizeMultiplier={1.3}>
            {getDomainFromUrl(url)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function getDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url.length > 30 ? url.substring(0, 30) + '...' : url;
  }
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  labelContainer: {
    flex: 1,
  },
  labelText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
    lineHeight: 18,
  },
  urlPreview: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  notProvidedText: {
    fontSize: 14,
    fontWeight: '400',
    fontStyle: 'italic',
    marginLeft: 12,
  },
});