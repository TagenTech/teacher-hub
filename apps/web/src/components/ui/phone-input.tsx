'use client';

import { formatPhone } from '@turmei/contracts';
import * as React from 'react';
import { Input, type InputProps } from './input';

interface PhoneInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  value: string | null | undefined;
  /** Devolve só os dígitos. */
  onChange: (digits: string) => void;
}

export function PhoneInput({ value, onChange, ...props }: PhoneInputProps) {
  return (
    <Input
      {...props}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder="(11) 98765-4321"
      value={formatPhone(value ?? '')}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 13))}
    />
  );
}
