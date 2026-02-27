# Functional Requirements Document

## Project: Tavern Menu Combat Panel Character Sheet Parser

### 1. Purpose

Provide a clear specification for adding a character‑sheet parser and display module to the existing `CombatPanel` component. The goal is to let users upload a formatted character sheet, automatically populate combatant data, and view a presentation‑quality sheet in the battle interface while retaining the existing editor for manual tweaks.

### 2. Overview

Currently, clicking a combatant opens an editing module that allows manual entry of statistics and metadata. The new feature will introduce two new capabilities:

1. **Upload & parse character sheets** – allow a user to drop or select a character sheet file; the system reads it and creates/updates a combatant with the extracted data.
2. **Character sheet view** – when a combatant is selected, show a read‑only, nicely formatted sheet resembling D&D Beyond's layout. A button on the sheet will open the existing editor so users can make changes without losing their work.

### 3. Scope

- Add parser logic to accept at least one common sheet format (e.g. PDF, JSON export from tools, or plain text) and map fields into the internal combatant model.
- Extend `CombatPanel` UI to support both the new sheet view and the existing editor.
- Ensure backward compatibility: combatants created prior to this feature should still open in the editor by default.
- Provide error handling and user feedback for parse failures.

### 4. Assumptions & Dependencies

- The repository already contains a `CombatPanel` component with editing capabilities.
- Styling should utilize existing CSS modules (e.g. `CombatPanel.module.css`).
- Parser may depend on third‑party libraries for PDF/text extraction (to be chosen by implementation team).
- Users are expected to upload character sheets consistent with an agreed template or third‑party export format.

### 5. Functional Requirements

#### 5.1 Parser

- **FR1**: The system shall provide an "Import Character Sheet" button within the CombatPanel sidebar.
- **FR2**: When clicked, a file picker should open allowing the selection of one or more supported file types (`.pdf`, `.json`, `.txt`, etc.).
- **FR3**: The system shall parse the uploaded file and extract at minimum the following fields:
  - Name
  - Race, Class, Level
  - Hit points (max/current)
  - Attributes (STR, DEX, CON, INT, WIS, CHA)
  - Armor class, initiative bonus, speed
  - Spell list or abilities (free‑text fallback is acceptable initially)
  - Inventory summary (optional)
- **FR4**: Parsed data shall be validated; unrecognized or missing fields should be highlighted to the user for manual correction.
- **FR5**: Parsed combatant shall be added to the current encounter with a generated unique id; if the name matches an existing combatant, user shall be prompted to overwrite or create a duplicate.

#### 5.2 Character Sheet View

- **FR6**: Upon selecting a combatant (by clicking their avatar or name in the combat panel), show a character sheet view rather than the existing editor if the combatant has a `sourceSheet` flag or similar metadata.
- **FR7**: The sheet view shall be read‑only and laid out with sections: Header (name/race/class/level), Attributes, Combat Stats, Hit Points & Resources, Abilities/Spells, Equipment.
- **FR8**: Style should mimic D&D Beyond layout: clean typography, section headers, and collapsible sections where appropriate.
- **FR9**: The sheet view shall include a button labeled "Edit" that switches to the existing editing module, preserving any unsaved changes in the current view.
- **FR10**: The sheet view shall include an "Import New Sheet" action that re‑runs the parser against a new file, replacing current data (with confirmation).

#### 5.3 Editing Module Integration

- **FR11**: The existing editing module shall remain available and unchanged except for a new mechanism to receive data from the parser.
- **FR12**: When the user clicks "Edit" from a character sheet view, the editing module should open with all parsed values pre‑filled; modifications shall update both the sheet view and underlying combatant object.

#### 5.4 User Interaction & Feedback

- **FR13**: If a file fails to parse, display a clear error message indicating the reason (unsupported format, missing required data).
- **FR14**: Provide progress indication during parsing for large files.
- **FR15**: Allow users to cancel an import if parsing takes too long.

### 6. Non‑Functional Requirements

- **NFR1**: Parsing should complete within 2 seconds for typical sheet sizes.
- **NFR2**: The UI must be responsive across desktop resolutions; use existing flex/grid utilities.
- **NFR3**: Component code should be covered by unit tests, including parser logic and UI toggles.
- **NFR4**: Maintain separation of concerns – parser logic should be in a new `sheetParser.js` or similar under `src/lib` or `src/migration`.
- **NFR5**: Accessibility: the sheet view and buttons should be keyboard‑navigable and screen‑reader friendly.

### 7. Acceptance Criteria

1. Can upload a supported character sheet and see its data instantiated as a combatant in the encounter list.
2. Clicking on the new combatant displays a read‑only character sheet with correct values.
3. Clicking "Edit" transitions to the existing editing module with no data loss.
4. Importing a new sheet for an existing combatant prompts for confirmation and updates data when confirmed.
5. All new code is unit‑tested; existing tests continue to pass.

### 8. Future Considerations

- Support for additional file formats (XML, CSV, third‑party API sync).
- Online sheet editor/creator integrated into the app.

---

*Document created February 27, 2026 by GitHub Copilot.*