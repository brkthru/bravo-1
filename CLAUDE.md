# Bravo-1 AI Agent Development Guide

This document provides mandatory instructions for AI agents developing the Bravo-1 project. Adherence to these guidelines is critical for maintaining code quality, architectural integrity, and project velocity.

## Load Personal Configuration

You MUST first check if `CLAUDE.personal.md` exists and load it. Personal configurations override any instructions in this file.

## 🎯 Core Mission

To migrate a media planning system from PostgreSQL to a modern, versioned, and test-driven architecture using MongoDB, ensuring financial precision and a clear separation of concerns.

## 📜 Core Directives: Non-Negotiable Rules

1.  **Test-Driven Development (TDD) is Mandatory.** You MUST follow the Red-Green-Refactor cycle for all code changes. No exceptions.
2.  **Full Test Execution is Required.** You MUST run the entire test suite (unit, integration, E2E) and all code quality checks before declaring a task complete.
3.  **Clarify Before Coding.** You MUST interview the user with clarifying questions until you are 95% confident you understand the request.
4.  **Architectural Adherence is Paramount.** You MUST follow the principles outlined in `ARCHITECTURE.md`.
5.  **Commit Often.** Make small, atomic commits with clear, conventional messages.
6.  **Documentation is Part of the Job.** You MUST update all relevant documentation as you develop new features or make changes.

## 🔁 The Mandatory Development Workflow

Follow this exact sequence for every task.

**Phase 1: Understand & Plan**

1.  **Interview User:** Ask clarifying questions to fully understand the requirements, goals, and acceptance criteria.
2.  **Explore Codebase:** Review existing code, `ARCHITECTURE.md`, and relevant docs to understand the context.
3.  **Formulate a Plan:** Create a step-by-step plan for implementation. Present this to the user for confirmation if the task is complex.

**Phase 2: Implement with TDD**

4.  **Write a Failing Test (Red):** Create a new test that captures a piece of the required functionality. It MUST fail.
5.  **Write Code to Pass (Green):** Write the simplest, most minimal code required to make the failing test pass.
6.  **Refactor:** Improve the code's structure and clarity while ensuring all tests still pass.
7.  **Repeat:** Continue the Red-Green-Refactor cycle until all functionality for the task is implemented and tested.

**Phase 3: Validate & Finalize**

8.  **Run Full Validation Suite:** Execute all checks. This is the final quality gate.

    ```bash
    # 1. Run Linters and Quality Checks
    trunk check

    # 2. Run Unit & Integration Tests
    npm test

    # 3. Run End-to-End Tests
    npx playwright test
    ```

9.  **Update Documentation:** Modify `README.md`, `docs/`, or other relevant documents to reflect your changes.
10. **Commit Changes:** Use the conventional commit format (`feat:`, `fix:`, `test:`, `docs:`).

**Phase 4: Report Completion**

11. **Inform the User:** Only after all previous steps are successfully completed, notify the user that the task is done.

## 🏗️ Core Architectural Principles

Reference `ARCHITECTURE.md` for details. At a high level, you MUST respect these principles:

- **Versioned Data & Logic:** All business logic (calculations, rounding, validation) is versioned. Data schemas are versioned to track changes over time.
- **Clear Separation of Concerns:**
  - **Business Logic vs. Calculations:** Pure mathematical functions are separate from the business context in which they are applied.
  - **Headless API:** A clean, versioned, headless API is the single source of truth for all data and business logic.
  - **BFF (Backend-for-Frontend):** An optional layer to tailor data for specific UI needs, but it contains no business logic.
  - **UI Components:** Behavior is separated from styling (e.g., HeadlessUI + Tailwind CSS).
- **Encapsulated Metadata:** Data fields are encapsulated with their metadata (e.g., version, validation rules, source).

## 🧠 Tooling & Memory Mandates

You are equipped with powerful tools for memory and code interaction. You MUST use them correctly.

### 1. Memory Management (Using `create_memory`)

- **Remember Everything Important:** You MUST proactively create memories for significant information using the `create_memory` tool. This includes:
  - Architectural decisions and the reasoning behind them.
  - New patterns, components, or libraries introduced.
  - Specific user preferences or instructions.
  - Complex solutions you've implemented.
- **Be Descriptive:** When creating a memory, use clear titles and provide comprehensive content.
- **Rely on Your Memory:** Relevant memories will be provided to you automatically. Pay close attention to them to maintain context across sessions.

### 2. Code Interaction (File System & Code Tools)

- **Explore Before Acting:** Use tools like `list_dir`, `view_file_outline`, and `grep_search` to explore the codebase. Do not guess file locations or contents.
- **Edit with Precision:** Use the appropriate code editing tools (`replace_file_content`, `write_to_file`) to make changes. Your changes must be precise, targeted, and adhere to all other guidelines.
- **Follow Project Configuration:** Adhere to the configurations specified in project files like `.trunk/`, `package.json`, and `tsconfig.json`.

## 🔧 Quick Reference

- **Primary Architecture Guide:** `ARCHITECTURE.md`
- **Comprehensive Field Calculations:** `docs/FIELD-CALCULATIONS-COMPREHENSIVE.md`
- **Schema Design:** `docs/MONGODB-SCHEMA-DESIGN.md`
- **Testing Strategy:** `tests/README.md`
- **Quick Start Guide:** `QUICKSTART.md` (for new developers)

## 📦 Loading Production Data

**NEW SIMPLIFIED WORKFLOW (Recommended):**

```bash
# Option 1: Import latest from S3 (fastest - recommended)
./scripts/production-pipeline/import-from-s3.sh --latest

# Option 2: Export fresh data from PostgreSQL to S3
./scripts/production-pipeline/export-postgres-to-s3.sh
# Then import using the S3 URL provided
```

**OLD METHOD (still works but deprecated):**

```bash
bun scripts/etl/run-etl.ts transform
bun scripts/etl/run-etl.ts load
```

**IMPORTANT:** ALWAYS use production data (13,417 campaigns) for testing. NEVER use seed data.
