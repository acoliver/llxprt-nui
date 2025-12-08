import { useEffect } from "react";
import { setThemeSuggestions, setProfileSuggestions } from "../slash";
import { listAvailableProfiles } from "../llxprtConfig";
import type { ThemeDefinition } from "../theme";

export function useSuggestionSetup(themes: ThemeDefinition[]): void {
  useEffect(() => {
    setThemeSuggestions(themes.map((entry) => ({ slug: entry.slug, name: entry.name })));
  }, [themes]);

  useEffect(() => {
    listAvailableProfiles()
      .then((profiles) => setProfileSuggestions(profiles))
      .catch(() => {
        return;
      });
  }, []);
}
