import type { UIState, Workflow } from "../app/engine";
import { SearchResults, type Section } from "../flows/search/SearchResults";
import { TodosView } from "../flows/todos/TodosView";
import {
  LeetCodeView,
  type LcListItem,
  type LcCategoryStat,
  type LcDashboard,
} from "../flows/leetcode/LeetCodeView";

type Props = {
  uiState: UIState;
  sections: Section[];
  onSelect: (globalIndex: number) => void;
  onRun: (globalIndex: number) => void;

  // todos
  todos: Extract<Workflow, { type: "todo" }>[];
  onTodosSelect: (index: number) => void;
  onTodosSetMode: (mode: UIState["todos"]["mode"]) => void;
  onTodosShiftDay: (delta: number) => void;
  onTodosToday: () => void;
  onTodosSetDay: (dayStartMs: number) => void;
  onTodosSetCalendarOpen: (open: boolean) => void;
  onTodosSetTagFilter: (tag: string | null) => void;

  // leetcode
  lcItems: LcListItem[];
  lcTab: UIState["leetcode"]["tab"];
  lcCategory: string;
  lcCategories: LcCategoryStat[];
  lcSelectedIndex: number;
  lcTodayTotal: number;
  lcTodayDone: number;
  lcDashboard: LcDashboard;
  lcCountByYmd: Record<string, number>;

  onLcSelect: (index: number) => void;
  onLcSetTab: (tab: UIState["leetcode"]["tab"]) => void;
  onLcSetCategory: (category: string) => void;
};

export function BodyRenderer({
  uiState,
  sections,
  onSelect,
  onRun,
  todos,
  onTodosSelect,
  onTodosSetMode,
  onTodosShiftDay,
  onTodosToday,
  onTodosSetDay,
  onTodosSetCalendarOpen,
  onTodosSetTagFilter,
  lcItems,
  lcTab,
  lcCategory,
  lcCategories,
  lcSelectedIndex,
  lcTodayTotal,
  lcTodayDone,
  onLcSelect,
  onLcSetTab,
  onLcSetCategory,
  lcDashboard,
  lcCountByYmd,
}: Props) {
  switch (uiState.view) {
    case "search":
      return (
        <div style={{ height: "100%", overflowY: "auto" }}>
          <SearchResults
            sections={sections}
            selectedIndex={uiState.selectedIndex}
            onSelect={onSelect}
            onRun={onRun}
          />
        </div>
      );

    case "todos":
      return (
        <TodosView
          todos={todos}
          tab={uiState.todos.tab} // kept for compatibility, but TodosView ignores it
          tagFilter={uiState.todos.tagFilter}
          onSetTagFilter={onTodosSetTagFilter}
          selectedIndex={uiState.todos.selectedIndex}
          onSelect={onTodosSelect}
          mode={uiState.todos.mode}
          selectedDayStartMs={uiState.todos.selectedDayStartMs}
          onSetMode={onTodosSetMode}
          onShiftDay={onTodosShiftDay}
          onToday={onTodosToday}
          onSetDay={onTodosSetDay}
          calendarOpen={uiState.todos.calendarOpen}
          onSetCalendarOpen={onTodosSetCalendarOpen}
        />
      );

    case "leetcode":
      return (
        <LeetCodeView
          tab={lcTab}
          category={lcCategory}
          categories={lcCategories}
          onSetTab={onLcSetTab}
          onSetCategory={onLcSetCategory}
          items={lcItems}
          selectedIndex={lcSelectedIndex}
          onSelect={onLcSelect}
          todayTotal={lcTodayTotal}
          todayDone={lcTodayDone}
          dashboard={lcDashboard}
          countByYmd={lcCountByYmd}
        />
      );

    default:
      return null;
  }
}
