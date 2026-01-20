import type { UIState } from "../app/engine";
import { SearchResults, type Section } from "../flows/search/SearchResults";

type Props = {
  uiState: UIState;
  sections: Section[];
  onSelect: (globalIndex: number) => void;
  onRun: (globalIndex: number) => void;
};

export function BodyRenderer({ uiState, sections, onSelect, onRun }: Props) {
  switch (uiState.view) {
    case "search":
      return (
        <SearchResults
          sections={sections}
          selectedIndex={uiState.selectedIndex}
          onSelect={onSelect}
          onRun={onRun}
        />
      );
    default:
      return null;
  }
}
