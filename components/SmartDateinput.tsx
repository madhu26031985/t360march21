import React from 'react';
import { TextInput, TextInputProps } from 'react-native';

interface SmartDateInputProps extends Omit<TextInputProps, 'onChangeText' | 'value'> {
  value: string;
  onChangeText: (text: string) => void;
  format?: 'YYYY-MM-DD' | 'MM-DD-YYYY' | 'DD-MM-YYYY';
}

export default function SmartDateInput({ 
  value, 
  onChangeText, 
  format = 'YYYY-MM-DD',
  ...props 
}: SmartDateInputProps) {
  
  const formatDateInput = (input: string) => {
    // Remove all non-numeric characters
    const numbers = input.replace(/\D/g, '');
    
    // Limit to 8 digits (DDMMYYYY or MMDDYYYY or YYYYMMDD)
    const limitedNumbers = numbers.slice(0, 8);
    
    if (limitedNumbers.length === 0) return '';
    
    let formatted = '';
    
    switch (format) {
      case 'YYYY-MM-DD':
        // Format as YYYY-MM-DD
        if (limitedNumbers.length <= 4) {
          formatted = limitedNumbers;
        } else if (limitedNumbers.length <= 6) {
          formatted = `${limitedNumbers.slice(0, 4)}-${limitedNumbers.slice(4)}`;
        } else {
          formatted = `${limitedNumbers.slice(0, 4)}-${limitedNumbers.slice(4, 6)}-${limitedNumbers.slice(6)}`;
        }
        break;
        
      case 'MM-DD-YYYY':
        // Format as MM-DD-YYYY
        if (limitedNumbers.length <= 2) {
          formatted = limitedNumbers;
        } else if (limitedNumbers.length <= 4) {
          formatted = `${limitedNumbers.slice(0, 2)}-${limitedNumbers.slice(2)}`;
        } else {
          formatted = `${limitedNumbers.slice(0, 2)}-${limitedNumbers.slice(2, 4)}-${limitedNumbers.slice(4)}`;
        }
        break;
        
      case 'DD-MM-YYYY':
        // Format as DD-MM-YYYY
        if (limitedNumbers.length <= 2) {
          formatted = limitedNumbers;
        } else if (limitedNumbers.length <= 4) {
          formatted = `${limitedNumbers.slice(0, 2)}-${limitedNumbers.slice(2)}`;
        } else {
          formatted = `${limitedNumbers.slice(0, 2)}-${limitedNumbers.slice(2, 4)}-${limitedNumbers.slice(4)}`;
        }
        break;
    }
    
    return formatted;
  };

  const handleTextChange = (text: string) => {
    const formatted = formatDateInput(text);
    onChangeText(formatted);
  };

  const getPlaceholder = () => {
    switch (format) {
      case 'YYYY-MM-DD': return 'YYYY-MM-DD (e.g., 2024-12-25)';
      case 'MM-DD-YYYY': return 'MM-DD-YYYY (e.g., 12-25-2024)';
      case 'DD-MM-YYYY': return 'DD-MM-YYYY (e.g., 25-12-2024)';
      default: return 'Enter date';
    }
  };

  return (
    <TextInput
      {...props}
      value={value}
      onChangeText={handleTextChange}
      placeholder={props.placeholder || getPlaceholder()}
      keyboardType="numeric"
      maxLength={format === 'YYYY-MM-DD' ? 10 : 10} // All formats are 10 characters with dashes
    />
  );
}