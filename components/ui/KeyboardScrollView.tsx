import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Platform,
  ScrollView,
  TextInput,
  View,
  type KeyboardEvent,
  type ScrollViewProps,
} from "react-native";

// Keyboard dismissal for any scrollable list: with "handled", a tap on empty
// space (anything that isn't a button/input) drops the keyboard, while taps
// on buttons still land on the first try instead of only closing it; a drag
// dismisses it too. Spread onto FlatLists that sit under a text input.
export const KEYBOARD_DISMISS_PROPS = {
  keyboardShouldPersistTaps: "handled",
  keyboardDismissMode: Platform.OS === "ios" ? "interactive" : "on-drag",
} as const satisfies ScrollViewProps;

// iOS sends "will" events (so the scroll runs alongside the keyboard
// animation); Android only reliably sends "did".
const SHOW_EVENT = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
const HIDE_EVENT = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

// Drop-in ScrollView for any screen with text inputs. On top of
// KEYBOARD_DISMISS_PROPS, when the keyboard opens (or focus moves to another
// field) it scrolls the focused input to the vertical center of the part of
// the scroll view the keyboard leaves visible, padding the bottom by the
// keyboard overlap so even the last field can get there. Replaces a
// KeyboardAvoidingView wrapper — don't nest it in one or the overlap is
// counted twice. No-op on web, which has no keyboard events.
export function KeyboardScrollView({ children, ...props }: ScrollViewProps) {
  const scrollRef = useRef<ScrollView>(null);
  const innerRef = useRef<View>(null);
  const [overlap, setOverlap] = useState(0);

  useEffect(() => {
    const onShow = (e: KeyboardEvent) => {
      const scroll = scrollRef.current?.getNativeScrollRef();
      if (!scroll) return;
      scroll.measureInWindow((_x, y, _w, height) => {
        const covered = Math.max(0, y + height - e.endCoordinates.screenY);
        setOverlap(covered);
        // Wait a frame so the overlap spacer is laid out before scrolling
        // into it.
        requestAnimationFrame(() => {
          const input = TextInput.State.currentlyFocusedInput();
          const inner = innerRef.current;
          if (!input || !inner) return;
          // Fails (silently) when the focused input isn't inside this scroll
          // view, e.g. a search box in the page header.
          input.measureLayout(
            inner,
            (_ix, inputY, _iw, inputHeight) => {
              const visible = height - covered;
              scrollRef.current?.scrollTo({
                y: Math.max(0, inputY + inputHeight / 2 - visible / 2),
                animated: true,
              });
            },
            () => {},
          );
        });
      });
    };
    const showSub = Keyboard.addListener(SHOW_EVENT, onShow);
    const hideSub = Keyboard.addListener(HIDE_EVENT, () => setOverlap(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <ScrollView
      {...KEYBOARD_DISMISS_PROPS}
      {...props}
      ref={scrollRef}
      innerViewRef={innerRef as React.RefObject<View>}
    >
      {children}
      {!!overlap && <View style={{ height: overlap }} />}
    </ScrollView>
  );
}
