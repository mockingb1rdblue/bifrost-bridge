< Settings

# Bifrost Bridge

# Issue statuses & automations

Issue statuses define the workflow that issues go through from start to completion. Here you can customize these statuses and automate how issues progress through them.

## Backlog

- **Backlog** `Default`
  24 issues
- **Unstarted**
- **Todo**

## Started

- **In Progress**

## In Review

- **In Review**
  Pull request is being reviewed

## PR Approved

- **PR Approved**
  PR and branch needs to be merged

## Completed

- **Done**
  PR and branch merged

## Canceled

- **Canceled**

## Duplicate

- **Duplicate**

---

Duplicate issue status.
Status issues move to when marked as a duplicate: `Duplicate`

---

## Pull request automations

With GitHub integration, you can automate issue workflows when opening or merging a pull request.
Linear supports both closing and contributing pull requests.

- On draft PR open, move to... `Todo`
- On PR open, move to... `In Progress`
- On PR review request or activity, move to... `In Review`
- On PR ready for merge, move to... `PR Approved`
- On PR merge, move to... `Done`

## Branch-specific rules

Set different rules for target branches, e.g. when a PR is merged into a specified branch.
`Add branch`

## Auto-close automations

Automate closing issues based on status changes to related issues, staleness, etc.

- **Auto-close parent issues**
  Automatically close an open parent issue when its last sub-issue is closed
- **Auto-close sub-issues**
  Automatically close all sub-issues when their parent issue is closed
- **Auto-close stale issues**
  Automatically close issues that haven't been completed, canceled, or updated in...

## Auto-archive closed issues, cycles, and projects

Closed (completed or canceled) issues, cycles, and projects are automatically archived after the set time period. Issues in cycles or projects will only be archived after the cycle or project has been archived. Changes apply within a day.

Auto-archive closed items after: `6 months`

---

## Re-order issues when moved to a new status

Define how issues should be ordered as they progress. Unless no action is chosen, issues moving to a previous status are always placed at the top of that status. This affects manual ordering.

When progressing status, place issues... `First`