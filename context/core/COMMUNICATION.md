# Communication Principles

The ability to transmit understanding across minds and machines effectively.

## Context Setting

How you bring others to your level of understanding.

1. Use BFS (breadth-first) to establish context. Give the big picture before diving deep.
2. Use DFS (depth-first) to explain specific processes or problems. Go deep only after context is set.
3. Start with the problem, not the solution. Let others understand why before how.
4. State your assumptions explicitly. What you consider obvious might not be.
5. Identify your audience's knowledge level. Adjust technical depth accordingly.
6. Map the territory before the journey. Show where you are, where you're going, and why.

## Organizational Communication

How you transmit information across hierarchies and stakeholders.

1. Match communication style to organizational level. CEOs need different information than developers.
2. For executives: Focus on business impact, risk, timeline, and cost.
3. For technical peers: Focus on implementation details, trade-offs, and technical debt.
4. For stakeholders: Focus on outcomes, milestones, and blockers.
5. Use visuals when words fail. Diagrams beat paragraphs for complex systems.
6. Document decisions with their reasoning. Future you will thank present you.
7. Be transparent about problems early. Hiding issues only compounds damage.
8. Communicate blockers immediately. Waiting costs everyone time.

## Clarity & Representation

How you externalize your internal understanding.

1. Write to think, not just to record. Writing clarifies fuzzy thoughts.
2. Use multiple representations: words, diagrams, flowcharts, tables, code comments.
3. Name things precisely. Vague names create vague understanding.
4. Avoid jargon when simpler words work. Clarity over cleverness.
5. Structure information hierarchically. Main point first, supporting details after.
6. Keep related information together. Don't make readers hunt across documents.
7. Use examples liberally. Abstract concepts need concrete anchors.
8. Update documentation when code changes. Stale docs are worse than no docs.

## Machine Communication

How you instruct systems, code, and agents to achieve goals.

1. Be explicit with machines. They don't infer intent; they execute instructions.
2. Treat agent prompts like function specifications. Clear input, expected output, edge cases.
3. When prompting always contextualize first, describe whats being persuited, what is the problem and plan the solution.
3. Debug by understanding the full data flow. Trace from source to destination.
4. Identify weak spots in your mental model. Where does your understanding break?
5. Question the source of truth. Is this data canonical or derived?
6. Learn by teaching machines. If you can't explain it to code, you don't understand it.
7. Read error messages completely. They often contain the solution.
8. Verify your assumptions with print statements, logs, or tests. Never guess and go for each root cause.

## Problem Communication

How you articulate what's broken and why you're stuck.

1. Separate symptoms from root causes. "It's slow" is not the same as "O(n²) algorithm on 10K items."
2. Provide reproduction steps. "It doesn't work" helps no one.
3. Share what you've already tried. Don't make others repeat your failed attempts.
4. State your hypothesis before asking for help. Show your thinking.
5. Include relevant context: environment, versions, data samples, logs.
6. Know when to ask for help. Being stuck for 2+ hours means ask earlier.
7. Explain your constraints. Time, resources, and dependencies matter.
8. Follow up with solutions. Close the loop so others can learn.


# Implementation Guidance

Master BFS context-setting first—it unlocks all other communication skills.
When stuck, write down your understanding. Gaps become obvious.

