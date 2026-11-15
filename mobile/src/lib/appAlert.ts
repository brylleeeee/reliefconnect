// src/lib/appAlert.ts  —  app-styled replacement for React Native's Alert.alert (Android's plain grey box)
// Same arguments as Alert.alert, so a call site only changes its name:
//   showAlert('Request sent', 'Your barangay will review it.')
//   showAlert('Cancel this request?', '…', [{ text: 'Keep it', style: 'cancel' }, { text: 'Cancel request', style: 'destructive', onPress }])
// <AlertHost /> in the root layout draws it.

export type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void | Promise<void>;
};

/** success = green check, warning = amber "!", error = red "x", info = blue "i", question = green "?" */
export type AlertTone = 'success' | 'warning' | 'error' | 'info' | 'question';

export type AlertRequest = {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
  tone: AlertTone;
};

type Listener = (queue: AlertRequest[]) => void;

let queue: AlertRequest[] = [];
let nextId = 1;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l(queue));

/** Guess the icon from the words, so existing calls look right without extra arguments. */
function guessTone(title: string, buttons: AlertButton[]): AlertTone {
  const t = title.toLowerCase();
  if (buttons.some((b) => b.style === 'destructive')) return 'error';
  if (/could not|not sent|not accepted|went wrong|failed|no connection|no internet/.test(t)) return 'error';
  if (/\bsent\b|changed|saved|done|success|submitted/.test(t)) return 'success';
  if (t.endsWith('?')) return 'question';
  if (/needed|missing|invalid|too |do not match|required|first|check|describe|choose|permission/.test(t)) return 'warning';
  return 'info';
}

export function showAlert(title: string, message?: string, buttons?: AlertButton[], options?: { tone?: AlertTone }) {
  const list = buttons?.length ? buttons : [{ text: 'OK' }];
  queue = [...queue, { id: nextId++, title, message, buttons: list, tone: options?.tone ?? guessTone(title, list) }];
  emit();
}

/** Removes the dialog on screen (called by AlertHost when a button is pressed). */
export function dismissAlert(id: number) {
  queue = queue.filter((a) => a.id !== id);
  emit();
}

export function subscribeAlerts(listener: Listener) {
  listeners.add(listener);
  listener(queue);
  return () => { listeners.delete(listener); };
}
