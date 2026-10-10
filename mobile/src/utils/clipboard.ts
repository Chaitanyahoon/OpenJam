import * as Clipboard from 'expo-clipboard';

/**
 * Copies a string to the system clipboard safely.
 * Returns true if successful, false on error.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch (err) {
    console.warn('Failed to copy to clipboard:', err);
    return false;
  }
}
