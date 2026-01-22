import type { UIState, Workflow, TodosMode } from "../app/engine";
import { SearchResults, type Section } from "../flows/search/SearchResults";
import { TodosView } from "../flows/todos/TodosView";

type Props = {
  uiState: UIState;
  sections: Section[];
  onSelect: (globalIndex: number) => void;
  onRun: (globalIndex: number) => void;
  todos: Extract<Workflow, { type: "todo" }>[];
  onTodosSelect: (index: number) => void;
  onTodosSetMode: (mode: TodosMode) => void;
  onTodosShiftDay: (delta: number) => void;
  onTodosToday: () => void;
  onTodosSetDay: (dayStartMs: number) => void;
  onTodosSetCalendarOpen: (open: boolean) => void;
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
}: Props) {
  if (uiState.view === "search") {
    return (
      <SearchResults
        sections={sections}
        selectedIndex={uiState.selectedIndex}
        onSelect={onSelect}
        onRun={onRun}
      />
    );
  }

  if (uiState.view === "todos") {
    return (
      <TodosView
        todos={todos}
        tab={uiState.todos.tab}
        tagFilter={uiState.todos.tagFilter}
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
  }

  return null;
}
