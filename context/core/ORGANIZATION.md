# Organization Principles

The ability to structure work, measure progress, and navigate uncertainty toward solutions.

## Task Decomposition

How you break large problems into manageable pieces.

1. Start with the end goal clearly defined. What does success look like?
2. Work backwards from the goal. What's the last step before completion?
3. Identify the critical path. Which tasks block everything else?
4. Break tasks until each is achievable in one focused session (<4 hours).
5. Name tasks by their outcome, not their activity. "User can log in" beats "Write auth code."
6. Make tasks testable. If you can't verify completion, split it further.
7. Separate discovery from execution. Research tasks need different time estimates.

## Dependency Management

How you map relationships between tasks and avoid bottlenecks.

1. Map dependencies before starting work. Draw the graph if needed.
2. Parallelize independent tasks. Don't serialize what can run concurrently.
3. Start dependency-heavy tasks first. They're your critical path.
4. Identify external dependencies early. Third-party APIs, approvals, reviews.
5. Break dependency chains when possible. Abstraction layers enable parallel work.
6. Communicate dependencies to your team. Others can't route around what they don't see.
7. Track blocking vs blocked tasks. Know what you're waiting on and who's waiting on you.

## Progress Measurement

How you know if you're moving forward or spinning in circles.

1. Define measurable milestones. "Almost done" is not a milestone.
2. Track actual progress, not effort. Hours worked ≠ value delivered.
3. Use working software as your progress metric. Code that runs beats code that compiles.
4. Compare estimates to actuals. Learn from your prediction errors.
5. Identify velocity trends. Are you speeding up or slowing down?
6. Celebrate completed milestones. Momentum is psychological.
7. Reset your baseline when scope changes. Don't measure new work against old plans.

## Time Projection

How you estimate effort and set realistic expectations.

1. Estimate in ranges, not points. "3-5 days" is more honest than "4 days."
2. Account for uncertainty in unknowns. Research tasks need wider ranges.
3. Add buffer for integration, testing, and documentation. Code isn't done until it ships.
4. Break unknowns into smaller unknowns. Time-box research to reduce uncertainty.
5. Track where time actually goes. Your gut lies; data doesn't.
6. Distinguish between effort and calendar time. 8 hours of work ≠ 1 day of calendar time.
7. Update ETAs when you learn new information. Old estimates with new facts are lies.

## Navigating Uncertainty

How you approach problems when you don't know the solution yet.

1. Acknowledge what you don't know. "I don't know yet" is a valid answer.
2. Classify unknowns: technical feasibility, implementation details, or requirements?
3. Time-box exploration. Give yourself 2 hours to research, then decide on approach.
4. Spike the riskiest assumption first. Validate or invalidate it early.
5. Document what you learn during exploration. Future you needs these notes.
6. Use algorithmic thinking for unknown problems: brute force first, then optimize.
7. Seek similar solved problems. Most "new" problems have existing patterns.
8. Break uncertainty loops by making a decision. Wrong direction beats no direction.

## Clarity & Visibility

How you maintain understanding of where you are and where you're going.

1. Keep a single source of truth for task status. One list, not scattered notes.
2. Distinguish between "in progress" and "blocked." Status ambiguity kills productivity.
3. Make your work visible to others. Invisible work can't be helped or celebrated.
4. Review your task list daily. Priorities shift; your list should too.
5. Archive completed tasks instead of deleting them. History teaches lessons.
6. Track scope creep explicitly. Know what's new vs what was planned.
7. Visualize your progress. Kanban boards, burndown charts—use what helps you see.


# Implementation Guidance

Master task decomposition first—it unlocks accurate estimation and dependency management.
When feeling overwhelmed, decompose further. Smaller tasks create clarity.

