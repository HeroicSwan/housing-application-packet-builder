# Manual accessibility test plan

Use synthetic records only. Test sign-in, dashboard, new case, document upload/review, application questions, signature, reviewer approval, template mapping, and error recovery.

For every flow, record browser, operating system, assistive technology, tester, date, result, and issue link. Verify keyboard-only operation and visible focus; logical heading/landmark structure; descriptive labels and errors; screen-reader announcement of status changes; 200% zoom without lost content; 320 CSS-pixel reflow; high-contrast/forced-colors; reduced motion; table and dialog semantics; and that color is never the only status cue.

Automated axe checks in the browser suite are a baseline, not a substitute for NVDA, JAWS, VoiceOver, or trained manual review. Any blocker in case intake, document review, signature, approval, or download must be fixed and retested before production approval.
