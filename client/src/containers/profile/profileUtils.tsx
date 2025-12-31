import { getSpecialtyTranslationKey } from '../../common/contexts/languageContext';

export function getSpecialtyDisplayName(
  specialtyName: string | null | undefined,
  t?: (key: string) => string
): string {
  if (!specialtyName) {
    return 'Unknown';
  }

  // If translation function is provided, use it
  if (t) {
    const translationKey = getSpecialtyTranslationKey(specialtyName);
    if (translationKey !== specialtyName) {
      return t(translationKey);
    }
  }

  // Fallback to original logic
  return specialtyName.replace(/_/g, ' ');
}
