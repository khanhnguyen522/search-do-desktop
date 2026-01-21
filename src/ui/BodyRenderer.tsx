import type { UIState, Workflow } from "../app/engine";
import { SearchResults, type Section } from "../flows/search/SearchResults";
import { TodosView } from "../flows/todos/TodosView";

type Props = {
  uiState: UIState;

  // Search view
  sections: Section[];
  onSelect: (globalIndex: number) => void;
  onRun: (globalIndex: number) => void;

  // Todos view (already filtered + sorted in App)
  todos: Extract<Workflow, { type: "todo" }>[];
  onTodosSelect: (index: number) => void;
};

export function BodyRenderer({
  uiState,
  sections,
  onSelect,
  onRun,
  todos,
  onTodosSelect,
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
      />
    );
  }

  return null;
}
