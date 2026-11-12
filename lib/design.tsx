import * as SecureStore from "expo-secure-store";
import { vars } from "nativewind";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { View } from "react-native";

import { colors, designPalettes, designVars } from "@/lib/colors";
import { isWeb } from "@/lib/platform";

// The two looks the app can wear: violet, the default (one electric violet
// paper and near-black panels, flat, torn along the bottom, tape only where a
// photo is stuck on, white stamps), and the original zine (purple and red
// paper, tilted, taped and clipped to the wall), which Settings can switch
// back to. It's a per-device preference, not saved to the account.
export type Design = "zine" | "violet";

const STORAGE_KEY = "beatboxd.design";

async function loadDesign(): Promise<Design | null> {
  try {
    const saved = isWeb ? globalThis.localStorage?.getItem(STORAGE_KEY) : await SecureStore.getItemAsync(STORAGE_KEY);
    return saved === "zine" || saved === "violet" ? saved : null;
  } catch {
    return null;
  }
}

async function saveDesign(design: Design) {
  try {
    if (isWeb) globalThis.localStorage?.setItem(STORAGE_KEY, design);
    else await SecureStore.setItemAsync(STORAGE_KEY, design);
  } catch {
    // Only a preference: it just won't be remembered.
  }
}

const DesignContext = createContext<{ design: Design; setDesign: (design: Design) => void }>({
  design: "violet",
  setDesign: () => {},
});

/** Holds the picked design and sets its colors as CSS variables over the
 * whole app (and, on web, on the page itself, so sheets portalled outside the
 * app's root follow it too). */
export function DesignProvider({ children }: { children: ReactNode }) {
  const [design, setDesignState] = useState<Design>("violet");

  useEffect(() => {
    loadDesign().then((saved) => saved && setDesignState(saved));
  }, []);

  useEffect(() => {
    if (!isWeb) return;
    for (const [name, value] of Object.entries(designVars(design))) {
      document.documentElement.style.setProperty(name, value);
    }
  }, [design]);

  const value = useMemo(
    () => ({
      design,
      setDesign: (next: Design) => {
        setDesignState(next);
        saveDesign(next);
      },
    }),
    [design],
  );
  const style = useMemo(() => vars(designVars(design)), [design]);

  return (
    <DesignContext.Provider value={value}>
      <View className="flex-1" style={style}>
        {children}
      </View>
    </DesignContext.Provider>
  );
}

export function useDesign() {
  return useContext(DesignContext);
}

/** The palette's colors as raw values for the current design, for the
 * places that can't use a class (SVG fills, a Switch's track). */
export function useDesignColors() {
  const { design } = useDesign();
  return useMemo(() => {
    const p = designPalettes[design];
    return {
      ...colors,
      primary: p.primary,
      "primary-dark": p["primary-dark"],
      accent: p.accent,
      "accent-text": p["accent-text"],
      zine: {
        ...colors.zine,
        purple: p["zine-purple"],
        "purple-ink": p["zine-purple-ink"],
        red: p["zine-red"],
        "red-ink": p["zine-red-ink"],
      },
      stamp: { red: p["stamp-red"], purple: p["stamp-purple"] },
    };
  }, [design]);
}
