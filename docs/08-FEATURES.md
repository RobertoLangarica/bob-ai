# bob-ai — Feature List

## MVP Feature Hierarchy

### Must-Have (Core Loop)

These features are required for the product to be usable.

| # | Feature | Description |
|---|---|---|
| 1 | **Create team** | Name, workspace, agent roles with model/API key config |
| 2 | **Team templates** | Pre-built SWE team config (UX, UI, Backend, Reviewer) |
| 3 | **Chat with team** | Natural language interface to assign tasks and interact |
| 4 | **Agent delegation** | Team lead delegates to specialists via spawn_agent |
| 5 | **Activity monitor** | Real-time feed showing what each agent is doing |
| 6 | **Pause / Resume / Stop** | Full lifecycle control over team execution |
| 7 | **Pre-launch briefing** | Inject .clinerules/bob-ai context into agent prompts |
| 8 | **Knowledge base** | read_knowledge tool for agents to query project docs |
| 9 | **Visual Workflow Builder** | Drag-drop hooks, assign agents, configure prompts |
| 10 | **Decision logging** | log_decision tool with structured decision documents |

### Should-Have (Usability)

Important for daily use but not blocking the first working version.

| # | Feature | Description |
|---|---|---|
| 11 | **Persist team configs** | Teams survive app restart (SQLite) |
| 12 | **Task history** | Browse past tasks and their results |
| 13 | **Agent role customization** | Edit system prompts per agent |
| 14 | **Workspace switching** | Same team, different repo |
| 15 | **Git standards tool** | commit_changes tool with conventional format |
| 16 | **Streaming responses** | See agent thinking in real-time via WebSocket |
| 17 | **Hook enable/disable** | Toggle individual hooks without deleting |
| 18 | **Agent-generated hooks** | create_hook tool for self-improvement |

### Nice-to-Have (Polish)

Features that enhance the experience but can wait.

| # | Feature | Description |
|---|---|---|
| 19 | **File diff preview** | Review code changes in-app |
| 20 | **Multi-team instances** | Run parallel teams on different repos |
| 21 | **Export conversations** | Save team work as markdown/PDF |
| 22 | **Workflow templates** | Pre-built workflows (SWE Quality Gate, etc.) |
| 23 | **Conditional workflow nodes** | If/else branching in workflow builder |
| 24 | **Cross-team hook sharing** | Suggest hooks from successful teams |
| 25 | **Command palette** | Cmd+K for quick actions |
| 26 | **System tray** | Background team status in menu bar |
| 27 | **Notifications** | Desktop notifications for task completion |

## Feature Dependencies

```
Create team (1)
  └→ Team templates (2)
  └→ Chat with team (3)
      └→ Agent delegation (4)
      └→ Activity monitor (5)
      └→ Pause/Resume/Stop (6)
  └→ Pre-launch briefing (7)
      └→ Knowledge base (8)
      └→ Decision logging (10)
  └→ Visual Workflow Builder (9)
      └→ Hook enable/disable (17)
      └→ Agent-generated hooks (18)
      └→ Conditional nodes (23)
```

## Phase Mapping

| Phase | Features | Goal |
|---|---|---|
| Phase 1 | 1-6 | Working team with chat and control |
| Phase 2 | 7-10 | Knowledge, workflows, and governance |
| Phase 3 | 11-18 | Persistence, customization, streaming |
| Phase 4 | 19-27 | Polish and advanced features |
