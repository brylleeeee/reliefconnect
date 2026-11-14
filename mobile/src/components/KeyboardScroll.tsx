// src/components/KeyboardScroll.tsx  —  a ScrollView that keeps the field you are typing in above the keyboard.
//
// Why: since Expo SDK 58, Android apps draw edge-to-edge, so the keyboard slides OVER the screen instead of
// making it shorter. The old fix (KeyboardAvoidingView with behavior only on iOS) did nothing on Android,
// and fields lower on the screen ended up hidden behind the keyboard.
//
// What it does:
//  - on Android, adds the keyboard's height as empty space at the bottom while it is open, so the page can scroll
//  - whenever the keyboard opens, you tap another field, or a field grows while typing, it scrolls just enough
//    to show the focused field (with a little gap) right above the keyboard
// Use it in place of <ScrollView>; keep the screen's KeyboardAvoidingView (it still handles iPhones).
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ComponentRef } from 'react';
import { Keyboard, Platform, ScrollView, TextInput, type ScrollViewProps } from 'react-native';

const GAP = 24; // space between the field and the top of the keyboard

type ScrollRef = ComponentRef<typeof ScrollView>;

const KeyboardScroll = forwardRef<ScrollRef, ScrollViewProps>(function KeyboardScroll(
  { contentContainerStyle, onScroll, onContentSizeChange, onTouchEnd, children, ...rest },
  ref,
) {
  const scrollRef = useRef<ScrollRef>(null);
  useImperativeHandle(ref, () => scrollRef.current as ScrollRef);

  const [extraSpace, setExtraSpace] = useState(0); // Android: room to scroll the content above the keyboard
  const keyboardTop = useRef<number | null>(null);  // screen position of the keyboard's top edge, while open
  const offset = useRef(0);                         // how far the page is scrolled right now

  // Scroll just enough to show the field being typed in
  const showFocused = useCallback(() => {
    const top = keyboardTop.current;
    const input = TextInput.State.currentlyFocusedInput?.();
    if (top == null || !input) return;
    input.measureInWindow((_x, y, _w, h) => {
      const hidden = y + h + GAP - top; // how much of the field (plus the gap) is behind the keyboard
      if (hidden > 0) scrollRef.current?.scrollTo({ y: offset.current + hidden, animated: true });
    });
  }, []);

  // after the layout settles (extra space added, keyboard finished sliding)
  const showFocusedSoon = useCallback(() => { setTimeout(showFocused, 60); }, [showFocused]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const shown = Keyboard.addListener(showEvent, (e) => {
      keyboardTop.current = e.endCoordinates.screenY;
      if (Platform.OS === 'android') setExtraSpace(e.endCoordinates.height);
      showFocusedSoon();
    });
    const hidden = Keyboard.addListener(hideEvent, () => {
      keyboardTop.current = null;
      setExtraSpace(0);
    });
    return () => { shown.remove(); hidden.remove(); };
  }, [showFocusedSoon]);

  // moving to the next field with the keyboard's "next" key (no tap, no keyboard event): check while it is open
  useEffect(() => {
    let last: unknown = null;
    const timer = setInterval(() => {
      if (keyboardTop.current == null) { last = null; return; }
      const now = TextInput.State.currentlyFocusedInput?.();
      if (now && now !== last) { last = now; showFocused(); }
    }, 250);
    return () => clearInterval(timer);
  }, [showFocused]);

  // the extra space was just added: now there is room to scroll
  useEffect(() => { if (extraSpace) showFocusedSoon(); }, [extraSpace, showFocusedSoon]);

  return (
    <ScrollView
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      scrollEventThrottle={16}
      {...rest}
      contentContainerStyle={[contentContainerStyle, extraSpace ? { paddingBottom: extraSpace } : null]}
      onScroll={(e) => { offset.current = e.nativeEvent.contentOffset.y; onScroll?.(e); }}
      // tapping another field while the keyboard is open
      onTouchEnd={(e) => { if (keyboardTop.current != null) showFocusedSoon(); onTouchEnd?.(e); }}
      // a multiline field grew while typing
      onContentSizeChange={(w, h) => { if (keyboardTop.current != null) showFocusedSoon(); onContentSizeChange?.(w, h); }}
    >
      {children}
    </ScrollView>
  );
});

export default KeyboardScroll;
