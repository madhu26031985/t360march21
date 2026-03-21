import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { ArrowLeft, Lock, CircleCheck as CheckCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

export default function PinSetup() {
  const { theme } = useTheme();
  const { setupPin } = useAuth();
  
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm' | 'success'>('enter');
  const [isLoading, setIsLoading] = useState(false);

  const handlePinInput = (digit: string) => {
    if (step === 'enter') {
      if (pin.length < 4) {
        setPin(prev => prev + digit);
      }
    } else if (step === 'confirm') {
      if (confirmPin.length < 4) {
        setConfirmPin(prev => prev + digit);
      }
    }
  };

  const handleBackspace = () => {
    if (step === 'enter') {
      setPin(prev => prev.slice(0, -1));
    } else if (step === 'confirm') {
      setConfirmPin(prev => prev.slice(0, -1));
    }
  };

  const handleContinue = () => {
    if (step === 'enter' && pin.length === 4) {
      setStep('confirm');
    } else if (step === 'confirm' && confirmPin.length === 4) {
      if (pin === confirmPin) {
        handleSetupPin();
      } else {
        Alert.alert('PIN Mismatch', 'PINs do not match. Please try again.', [
          { text: 'OK', onPress: () => {
            setPin('');
            setConfirmPin('');
            setStep('enter');
          }}
        ]);
      }
    }
  };

  const handleSetupPin = async () => {
    setIsLoading(true);
    
    try {
      const result = await setupPin(pin);
      
      if (result.success) {
        setStep('success');
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 2000);
      } else {
        Alert.alert('Setup Failed', result.error || 'Failed to setup PIN');
        setPin('');
        setConfirmPin('');
        setStep('enter');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
      setPin('');
      setConfirmPin('');
      setStep('enter');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  const renderPinDots = (currentPin: string) => {
    return (
      <View style={styles.pinDotsContainer}>
        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            style={[
              styles.pinDot,
              {
                backgroundColor: index < currentPin.length ? theme.colors.primary : theme.colors.surface,
                borderColor: theme.colors.border,
              }
            ]}
          />
        ))}
      </View>
    );
  };

  const renderNumberPad = () => {
    const numbers = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', '⌫']
    ];

    return (
      <View style={styles.numberPad}>
        {numbers.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.numberRow}>
            {row.map((number, colIndex) => (
              <TouchableOpacity
                key={colIndex}
                style={[
                  styles.numberButton,
                  { backgroundColor: number ? theme.colors.surface : 'transparent' }
                ]}
                onPress={() => {
                  if (number === '⌫') {
                    handleBackspace();
                  } else if (number) {
                    handlePinInput(number);
                  }
                }}
                disabled={!number || isLoading}
              >
                <Text style={[
                  styles.numberButtonText,
                  { color: number ? theme.colors.text : 'transparent' }
                ]} maxFontSizeMultiplier={1.3}>
                  {number}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    );
  };

  if (step === 'success') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.successContainer}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../assets/images/yy.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          
          <View style={[styles.successIcon, { backgroundColor: theme.colors.success + '20' }]}>
            <CheckCircle size={32} color={theme.colors.success} />
          </View>
          
          <Text style={[styles.successTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            PIN Setup Complete!
          </Text>
          
          <Text style={[styles.successMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            You can now use your 4-digit PIN for quick access to the app.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={[styles.skipButtonText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Logo Section */}
        <View style={styles.logoSection}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../assets/images/yy.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.title, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {step === 'enter' ? 'Setup Your PIN' : 'Confirm Your PIN'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            {step === 'enter' 
              ? 'Create a 4-digit PIN for quick access'
              : 'Enter your PIN again to confirm'
            }
          </Text>
        </View>

        {/* PIN Input Section */}
        <View style={styles.pinSection}>
           
          {renderPinDots(step === 'enter' ? pin : confirmPin)}
          
          {renderNumberPad()}
          
          {/* Continue Button */}
          <TouchableOpacity
            style={[
              styles.continueButton,
              {
                backgroundColor: (step === 'enter' ? pin.length === 4 : confirmPin.length === 4) 
                  ? theme.colors.primary 
                  : theme.colors.surface,
                borderColor: theme.colors.border,
              }
            ]}
            onPress={handleContinue}
            disabled={(step === 'enter' ? pin.length !== 4 : confirmPin.length !== 4) || isLoading}
          >
            <Text style={[
              styles.continueButtonText,
              { 
                color: (step === 'enter' ? pin.length === 4 : confirmPin.length === 4) 
                  ? '#ffffff' 
                  : theme.colors.textSecondary 
              }
            ]} maxFontSizeMultiplier={1.3}>
              {isLoading ? 'Setting up...' : (step === 'enter' ? 'Continue' : 'Setup PIN')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Security Note */}
        <View style={[styles.securityNote, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.securityNoteTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Security Note</Text>
          <Text style={[styles.securityNoteText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Your PIN is encrypted and stored securely on your device. You can change or remove it anytime in Settings.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  backButton: {
    padding: 8,
  },
  skipButton: {
    padding: 8,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    marginBottom: 32,
  },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  pinSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  pinIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  pinDotsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 40,
  },
  pinDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  numberPad: {
    gap: 16,
    marginBottom: 32,
  },
  numberRow: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  numberButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  numberButtonText: {
    fontSize: 24,
    fontWeight: '600',
  },
  continueButton: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  securityNote: {
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  securityNoteTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  securityNoteText: {
    fontSize: 14,
    lineHeight: 20,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  successMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
});