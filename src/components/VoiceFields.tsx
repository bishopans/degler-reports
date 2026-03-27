'use client';
import React from 'react';
import DictateButton from './DictateButton';

// Drop-in replacement for <input type="text"> with a mic button
export function VoiceInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & { value?: string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void }
) {
  const { value, onChange, style, ...rest } = props;

  const handleDictate = (text: string) => {
    if (!onChange) return;
    const current = (value as string) || '';
    const newValue = current ? current + ' ' + text : text;
    const syntheticEvent = { target: { value: newValue } } as React.ChangeEvent<HTMLInputElement>;
    onChange(syntheticEvent);
  };

  return (
    <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
      <input value={value} onChange={onChange} style={{ flex: 1, ...style }} {...rest} />
      <DictateButton onResult={handleDictate} />
    </div>
  );
}

// Drop-in replacement for <textarea> with a mic button in the top-right
export function VoiceTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { value?: string; onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void }
) {
  const { value, onChange, style, ...rest } = props;

  const handleDictate = (text: string) => {
    if (!onChange) return;
    const current = (value as string) || '';
    const newValue = current ? current + ' ' + text : text;
    const syntheticEvent = { target: { value: newValue } } as React.ChangeEvent<HTMLTextAreaElement>;
    onChange(syntheticEvent);
  };

  return (
    <div style={{ position: 'relative' }}>
      <textarea value={value} onChange={onChange} style={{ paddingRight: '3rem', ...style }} {...rest} />
      <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem' }}>
        <DictateButton onResult={handleDictate} />
      </div>
    </div>
  );
}
