Objective:
Analyze my entire codebase and database schema, then adapt a feature specification into a concrete implementation plan aligned with the current system.

Instructions:

1. Codebase Analysis
- Read and understand the full codebase structure.
- Identify main modules, architecture patterns, and existing features.
- Pay special attention to how data flows between frontend, backend, and database.

2. Database Analysis (Supabase)
- Inspect all existing tables, columns, and relationships.
- Understand constraints, indexes, and how data is currently used.
- Use MCP Supabase access if needed to retrieve schema details.

3. Feature Analysis
- Open and read the file located at: `/features/CHATBOT.md`
- Fully understand the feature requirements and expected behavior.

4. Adaptation to Current System
- Transform the feature into a **realistic implementation plan** based on:
  - Current codebase structure
  - Existing database schema
- Ensure compatibility with existing patterns and conventions.

5. Database Changes (if needed)
- Propose necessary changes such as:
  - New tables
  - New columns
  - Modified relationships
- Clearly justify each change.
- Keep changes minimal and consistent with the current design.

6. Implementation Plan
Produce a detailed plan including:
- Architecture overview
- Backend changes (APIs, services, logic)
- Frontend changes (UI, state, flows)
- Database modifications
- Edge cases and validations
- Step-by-step execution plan

7. Output
- Create a new file at:
  `/features/CHATBOT.md`
- The file should be clean, structured, and ready for development use.

Constraints:
- Do NOT break existing functionality.
- Follow existing conventions in the codebase.
- Prefer simple and scalable solutions over complex ones.