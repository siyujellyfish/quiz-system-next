# Default question banks

This directory contains the version-controlled seed bundle for the project's four default question banks:

- CEH v13 — 332 questions
- CTIA v2 — 88 questions
- EDRP v3 — 153 questions
- CSA v2 — 100 questions

Total: 673 questions.

The `question-banks.part*.b64` files are ordered chunks of one gzip-compressed, base64-encoded JSON bundle. `scripts/seed-question-banks.ts` concatenates, decodes and validates the bundle before seeding or synchronizing the database.

Each bundled question contains a static `explanation`. These explanations are ordinary question-bank content and never invoke AI at runtime. AI functionality remains a separate, explicitly user-triggered feature.

See `CORRECTIONS.md` for high-confidence source-answer corrections and questions that still warrant manual review.
