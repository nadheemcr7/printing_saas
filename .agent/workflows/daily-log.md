---
description: Create a detailed activity log for the current day
---

To document the work done today:

1. Create a new markdown file in `.agent/daily-logs/YYYY-MM-DD.md` (use today's date).
2. The log must include:
    - **Header**: `# Daily Activity Log - [Date]`
    - **Summary**: A high-level overview of what was achieved.
    - **Tasks Completed**: A bulleted list of technical tasks finished.
    - **Technical Decisions**: Explanation of why specific approaches (like AI Screenshot Verification) were chosen.
    - **File Changes**: List of new files created or major modifications.
    - **Next Steps**: What is planned for the next session.
3. Automatically link this new log in the `main-docs/PROGRESS.md` under a "History" section.

// turbo
4. Run `git add .agent/daily-logs` to track the history.
