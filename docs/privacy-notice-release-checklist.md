# Privacy notice release checklist

The in-app `/soukromi` page is a technical summary, not a complete public
privacy notice. The deployer must complete and review this checklist before
opening public registration.

- Identify the data controller/operator and provide a working privacy contact.
- State the purposes and legal bases for account management, progress sync,
  abuse prevention, and email delivery.
- Identify the hosting, SMTP, backup, and any other processors used by the
  actual deployment; provide their relevant locations and transfer details.
- Set and publish retention periods for active accounts, disabled accounts,
  immutable attempt events, reset/archived generations, security logs, queued
  mail, and backups.
- Decide and implement the account and personal-data erasure request process.
  The current progress reset is a logical reset and retains old server events.
- Review the wording against the deployed cookies, logs, SMTP relay, and
  service-worker behavior, then update `/soukromi` and this file together.
- Verify the published contact and notice after deployment over HTTPS.

Do not describe the technical summary as a completed legal notice until these
items have been resolved by the operator.
