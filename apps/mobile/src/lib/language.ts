import { getLocales } from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import { I18nManager } from 'react-native';
import { create } from 'zustand';
import i18n, { SUPPORTED_LANGUAGES } from '@/i18n';

/** "system" follows the phone's language (the default). */
export type LanguageChoice = 'system' | 'en' | 'ur';

const KEY = 'apniride.language';

function deviceLanguage(): 'en' | 'ur' {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code) ? (code as 'en' | 'ur') : 'en';
}

const resolve = (choice: LanguageChoice) => (choice === 'system' ? deviceLanguage() : choice);

interface LanguageState {
  choice: LanguageChoice;
  /** The layout direction changes only after the app restarts (React Native limitation). */
  restartNeeded: boolean;
}

export const useLanguage = create<LanguageState>()(() => ({ choice: 'system', restartNeeded: false }));

/** On app start, before the splash screen hides: apply the saved choice. Works offline. */
export async function loadLanguage(): Promise<void> {
  const saved = await SecureStore.getItemAsync(KEY).catch(() => null);
  const choice: LanguageChoice = saved === 'en' || saved === 'ur' ? saved : 'system';
  useLanguage.setState({ choice });
  if (choice !== 'system') await i18n.changeLanguage(choice);
}

/** Text changes at once; the right-to-left layout for Urdu after the app is reopened. */
export async function setLanguage(choice: LanguageChoice): Promise<void> {
  const language = resolve(choice);
  await i18n.changeLanguage(language);
  const rtl = language === 'ur';
  I18nManager.allowRTL(true);
  // "system": stop forcing, so the phone's own language decides the direction again.
  I18nManager.forceRTL(choice === 'system' ? false : rtl);
  useLanguage.setState({ choice, restartNeeded: I18nManager.isRTL !== rtl });
  await SecureStore.setItemAsync(KEY, choice).catch(() => undefined);
}
