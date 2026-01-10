import { SearchResults } from "../flows/search/SearchResults";
import { PracticeBody } from "../flows/leetcode/PracticeBody";
import type { UIState, Workflow } from "../app/engine";

type Props = {
  uiState: UIState;
  items: Workflow[];
  onSelect: (index: number) => void;
  onRun: (index: number) => void;
};

export function BodyRenderer({ uiState, items, onSelect, onRun }: Props) {
  switch (uiState.view) {
    case "search":
      return (
        <SearchResults
          items={items as any} // SearchResults đang nhận Workflow basic; nếu bạn đã đổi type thì bỏ any
          selectedIndex={uiState.selectedIndex}
          onSelect={onSelect}
          onRun={onRun}
        />
      );

    case "todayPlan":
    case "current":
      return <PracticeBody />;

    default:
      return null;
  }
}
