/**
 * TAS ERP Universal Haptic Feedback Helper
 * Gracefully provides vibration feedback on supported mobile devices
 */

type HapticStyle = "selection" | "impactLight" | "impactMedium" | "impactHeavy" | "success" | "error" | "warning";

export function triggerHaptic(style: HapticStyle = "impactLight"): void {
  if (typeof window === "undefined" || !window.navigator?.vibrate) {
    return;
  }

  try {
    switch (style) {
      case "selection":
        window.navigator.vibrate(8);
        break;
      case "impactLight":
        window.navigator.vibrate(15);
        break;
      case "impactMedium":
        window.navigator.vibrate(25);
        break;
      case "impactHeavy":
        window.navigator.vibrate(40);
        break;
      case "success":
        window.navigator.vibrate([12, 40, 18]);
        break;
      case "warning":
        window.navigator.vibrate([25, 40, 25]);
        break;
      case "error":
        window.navigator.vibrate([25, 30, 25, 30, 35]);
        break;
      default:
        window.navigator.vibrate(15);
    }
  } catch (_) {
    // Ignore environments where vibration is blocked or restricted
  }
}
