export function haptic(type: 'light' | 'medium' | 'error' | 'win-ward'): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  switch (type) {
    case 'light':    navigator.vibrate(8);           break; // ward place/remove
    case 'medium':   navigator.vibrate(22);          break; // watcher place/remove
    case 'error':    navigator.vibrate([25, 15, 25]); break; // invalid watcher
    case 'win-ward': navigator.vibrate(12);          break; // each ward in the win slam
  }
}
