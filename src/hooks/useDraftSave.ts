'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

interface DraftMeta {
  reportType: string;
  lastSaved: string;
  data: Record<string, unknown>;
}

/**
 * Auto-saves form data to localStorage and restores it on mount.
 *
 * Usage:
 *   const { draftRestored, draftTimestamp, clearDraft } = useDraftSave(reportType, formData, setFormData, isSubmitted);
 *
 * - Files (photos) and signatures are NOT saved (users must re-attach those).
 * - Drafts are keyed by report type so each form keeps its own draft.
 * - Auto-saves every 3 seconds when data changes.
 * - Draft is cleared automatically on successful submission.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useDraftSave<T extends Record<string, any>>(
  reportType: string,
  formData: T,
  setFormData: (data: T) => void,
  isSubmitted: boolean,
  /** Field keys that should NOT be saved/restored (e.g. photos, signature) */
  excludeKeys: string[] = ['photos', 'signature']
) {
  const storageKey = `dw-draft-${reportType}`;
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftTimestamp, setDraftTimestamp] = useState<string | null>(null);
  const [lastSaveTime, setLastSaveTime] = useState<string | null>(null);
  const hasRestoredRef = useRef(false);
  const formDataRef = useRef(formData);
  const isSubmittedRef = useRef(isSubmitted);

  // Keep refs current
  formDataRef.current = formData;
  isSubmittedRef.current = isSubmitted;

  // Restore draft on mount (once)
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return;

      const draft: DraftMeta = JSON.parse(stored);
      if (draft.reportType !== reportType || !draft.data) return;

      // Merge draft data into current form data, skipping excluded keys
      const restored = { ...formDataRef.current };
      for (const [key, value] of Object.entries(draft.data)) {
        if (!excludeKeys.includes(key) && key in restored) {
          (restored as Record<string, unknown>)[key] = value;
        }
      }

      setFormData(restored);
      setDraftRestored(true);
      setDraftTimestamp(draft.lastSaved);
    } catch {
      // Corrupt draft — clear it
      localStorage.removeItem(storageKey);
    }
  }, [storageKey, reportType, setFormData, excludeKeys]);

  // Auto-save every 3 seconds when form data changes
  useEffect(() => {
    const interval = setInterval(() => {
      if (isSubmittedRef.current) return;

      try {
        // Strip excluded keys before saving, and clean File objects from nested arrays
        const dataToSave: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(formDataRef.current)) {
          if (excludeKeys.includes(key)) continue;
          // If value is an array of objects (like time-sheet entries), strip File[] fields from each
          if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null && !(value[0] instanceof File)) {
            dataToSave[key] = value.map((item: Record<string, unknown>) => {
              const cleaned: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(item)) {
                if (Array.isArray(v) && v.length > 0 && v[0] instanceof File) continue;
                if (v instanceof File) continue;
                cleaned[k] = v;
              }
              return cleaned;
            });
          } else {
            dataToSave[key] = value;
          }
        }

        // Don't save if all values are empty/default
        const hasContent = Object.values(dataToSave).some((v) => {
          if (typeof v === 'string') return v.trim() !== '';
          if (Array.isArray(v)) return v.length > 0;
          if (typeof v === 'object' && v !== null) return Object.keys(v).length > 0;
          return v !== undefined && v !== null;
        });

        if (!hasContent) return;

        const now = new Date().toISOString();
        const draft: DraftMeta = {
          reportType,
          lastSaved: now,
          data: dataToSave,
        };
        localStorage.setItem(storageKey, JSON.stringify(draft));
        setLastSaveTime(now);
      } catch {
        // localStorage full or unavailable — fail silently
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [storageKey, reportType, excludeKeys]);

  // Clear draft on successful submission
  useEffect(() => {
    if (isSubmitted) {
      localStorage.removeItem(storageKey);
      setDraftRestored(false);
      setDraftTimestamp(null);
      setLastSaveTime(null);
    }
  }, [isSubmitted, storageKey]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
    setDraftRestored(false);
    setDraftTimestamp(null);
    setLastSaveTime(null);
  }, [storageKey]);

  const dismissDraftBanner = useCallback(() => {
    setDraftRestored(false);
  }, []);

  return { draftRestored, draftTimestamp, lastSaveTime, clearDraft, dismissDraftBanner };
}
