/** Sticky-note paper colors. Shared by the board (client) and the API (server). */
export const NOTE_COLORS = ['#FFF1B5', '#F8D3DA', '#D6EBD6', '#DCE6F6', '#EADFF5'] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];
