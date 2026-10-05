# Programming Principles

Think before applying these rules. Don't follow them blindly.
Trust no one; Not developers nor agents. Everyone makes mistakes when writing, using or explaining code.

## Code Craftsmanship

Writing clean, readable code at the line and function level.

1. Write code assuming the least experienced developer will use it. Make it mistake-proof for him.
2. Write code as if the best programmer in the world will review it. What would they think?
3. Pay attention to details.
4. Write unsurprising code. Re-read your code and eliminate anything confusing or unexpected.
5. Minimize cognitive load.
6. Keep code flat. Minimize nested blocks. Prefer early returns.
7. Read your code multiple times while writing it.
8. Use comments to explain why, not how or what.
9. Stay consistent with the existing codebase.
10. Use constants for strings that change or appear multiple times.
11. Prefer explicit code and behavior over implicit implementations.
12. Don't duplicate code within the same context. Duplication across different contexts is acceptable.
13. Add whitespace between related code blocks, like paragraphs in prose.
14. Avoid magic numbers. Use explicitly named constants.
15. Use short variable names only in short functions.

## System Design

Designing solutions, architecture, and building maintainable systems.

1. Choose progress over perfection. Perfection doesn't exist; Pursuing it only delays progress.
2. Every problem has multiple solutions. The first solution you find is rarely the best.
3. Write short, single-purpose functions.
4. Write single responsability files (>300LOC).
5. Optimize for common cases, not edge cases.
6. Write extensible code.
7. If you're stuck on a problem, revisit the input data. You may be missing information.
8. Prioritize readable, maintainable code over performance.
9. Maintain a single source of truth for your data.
10. Write future-proof code, not just for next week.
11. Actively consider what can go wrong with your code. Be creative about failure scenarios.
12. Design input and output data structures before writing algorithms process.
13. Consider how your code will run in different environments, not just your local machine.

## Safety & Security

Protection from failures, attacks, and managing trust boundaries.

1. When debugging, separate facts from assumptions. Verify each assumption systematically.
2. Never trust user or system input.
3. When uncertain, choose restrictive over permissive policies. Opening access is easier than restricting it later.
4. Clients (frontend, mobile apps) should trust backends cautiously and expect failures.
5. Backends must never trust their clients AT ALL.
6. Only return HTTP 5XX errors when something is genuinely broken.
7. Retry network-dependent operations.
8. Always handle errors properly. Developers ignore them since programming began and began an entire industry around error tracking. Handle them by:
    1. Returning the error to the caller
    2. Logging the error (essential for debugging production failures)
    3. Retrying the operation
    4. Executing a fallback operation
9. Always validate and sanitize user input.
10. Consider the worst-case scenario: What happens if someone misuses your code? How much money could be lost? What data could a hacker access?
11. Never modify global variables within threads unless they're thread-safe.
12. Never share variables accessed by multiple threads unless they're thread-safe.
13. Global variables are dangerous. Avoid them unless you have a compelling reason and fully understand the implications.
14. Never expose global variables to other packages unless you fully understand the consequences.
15. If using a global variable, make its name clearly indicate it should remain constant.
16. Use global variables only when alternatives are prohibitively expensive. Always evaluate alternative solutions first.

# Implementation Guidance

Follow principles sequentially to achieve well-designed functionality.
Consult stakeholders to determine importance of section eligibility.

# Working Principles

Apply at every interaction. Single source: `context/core/`.

@../context/core/ORGANIZATION.md
@../context/core/COMMUNICATION.md
@../context/core/OPTIMAL.md