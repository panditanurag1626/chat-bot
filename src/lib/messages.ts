// Message creation now lives in the repository (SQLite integer PK doubles as the
// client-facing numeric id used by the widget's after_id polling).
export { createMessage } from "./repo";
