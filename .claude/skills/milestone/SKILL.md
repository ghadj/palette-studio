---
name: milestone
description: Runs one roadmap milestone end to end with the analyst, implementer and evaluator subagents, with a human approval gate after planning.
disable-model-invocation: true
argument-hint: "[milestone id, e.g. M1]"
---

Run milestone $ARGUMENTS of docs/SPEC.md. You are the orchestrator: delegate the work, pass files between agents, and keep the user in control.

1. **Branch.** Make sure the working tree is clean. Create `milestone/$ARGUMENTS` from `main` and switch to it.

2. **Plan.** Delegate to the `milestone-analyst` subagent: "Plan milestone $ARGUMENTS." Wait for it to finish, then read `docs/milestones/$ARGUMENTS/plan.md`.

3. **Approval gate.** Show the user the task list, the open questions and the manual checks. Ask them to approve the plan, edit it, or answer the open questions. Don't continue until they explicitly approve. Commit the approved plan.

4. **Implement.** Delegate to the `implementer` subagent: "Implement docs/milestones/$ARGUMENTS/plan.md." If the plan has more than about eight tasks, delegate in groups of tasks and check progress between groups. If the implementer stops with a question, relay it to the user.

5. **Evaluate.** Delegate to the `evaluator` subagent: "Evaluate milestone $ARGUMENTS on branch milestone/$ARGUMENTS." Don't pass it the implementer's report, so its judgment stays independent. Save its report to `docs/milestones/$ARGUMENTS/report.md` and commit it.

6. **Fix loop.** If the verdict is FAIL, send the report's failures to the `implementer`, then evaluate again. Stop after two fix rounds and hand the remaining failures to the user.

7. **Visual sign-off.** If the milestone changed the UI:
   1. Point the user to `artifacts/visual-review/index.html`, along with the report's visual findings and its "not drawn" design checks.
   2. Ask them to approve or list changes.
   3. Send any changes to the `implementer`, then re-run the evaluator's visual check.
   4. Record the approval (date, shots) in the report.
   5. If baselines are due, ask before pushing the branch and running the `visual-baselines.yml` workflow on it (`gh workflow run visual-baselines.yml --ref milestone/$ARGUMENTS`).

8. **Hand off.** Summarize for the user:
   - the verdict
   - commits on the branch
   - the manual checks they need to do
   - any spec questions that came up

   Ask before pushing the branch or opening a pull request.
