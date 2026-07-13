import React from 'react';
import { Image, Text, View } from '@react-pdf/renderer';
import {
  avatarBorderColor,
  candidateInitials,
} from '../../utils/certifiedLedger/images';
import { tokens } from '../../utils/certifiedLedger/tokens';

/**
 * Circular candidate avatar for Certified Ledger PDF.
 * Prefers imageDataUrl (prefetched); falls back to initials.
 * Winner ring = ceremonial gold; others = brand violet.
 */
export function CandidateAvatar({
  candidate,
  size = 40,
  style,
}) {
  const border = Math.max(2, Math.round(size * 0.06));
  const ring = avatarBorderColor(Boolean(candidate?.isWinner));
  const src = candidate?.imageDataUrl || null;
  const initials = candidateInitials(candidate?.name);
  const fontSize = Math.max(8, Math.round(size * 0.34));

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: border,
          borderColor: ring,
          backgroundColor: tokens.ivory,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {src ? (
        <Image
          src={src}
          style={{
            width: size - border * 2,
            height: size - border * 2,
            borderRadius: (size - border * 2) / 2,
          }}
        />
      ) : (
        <View
          style={{
            width: size - border * 2,
            height: size - border * 2,
            borderRadius: (size - border * 2) / 2,
            backgroundColor: candidate?.isWinner ? '#F5EBD0' : '#EFEBF8',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: 'Inter',
              fontSize,
              fontWeight: 600,
              color: candidate?.isWinner ? tokens.gold : '#5C52C4',
            }}
          >
            {initials}
          </Text>
        </View>
      )}
    </View>
  );
}
