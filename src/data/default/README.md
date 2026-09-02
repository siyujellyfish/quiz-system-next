# Question-bank transfer notes

The repository no longer uses a bundled default question-bank artifact.

Question banks are transferred through the Admin JSON import/export flow. A complete import document contains `version`, `bank`, and `questions`; each question may include a static `explanation`.

If an imported slug already exists, the Admin importer safely synchronizes matching questions by prompt plus ordered option text so existing question UUIDs and user history are preserved. Unmatched imported questions are added, while existing database-only questions are not deleted.

`CORRECTIONS.md` remains as a data-quality note for source material reviewed during this feature work.
