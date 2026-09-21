# Triage Labels

**This repo has one triage label, and it is `steward`.** If a skill tells you to
apply a triage label, that is the only one that exists here.

```bash
gh issue edit <n> --add-label steward
```

`steward` means **in the steward's domain and available to pick up** — a state,
not a subject. `docs/agents/issue-tracker.md` has the rules that go with it,
including that removing it must leave a comment saying why.

Everything else in the tracker is a GitHub default (`bug`, `enhancement`,
`question`, `wontfix`, `duplicate`, `invalid`, `help wanted`) plus dependabot's
own (`dependencies`, `javascript`). None of them carries a triage meaning here.

## The five-role vocabulary this file used to describe does not exist

This file previously mapped five canonical roles from `mattpocock/skills` —
`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix` —
and said they were "the actual label strings used in this repo's issue
tracker". **Four of the five were never created.** The documented command
fails:

```
$ gh issue edit 117 --add-label ready-for-agent
failed to update …/issues/117: 'ready-for-agent' not found
```

That is the failure the root `AGENTS.md` describes as a rule that is **true,
agreed and unfollowable** — and it was worse than unfollowable, because the
mapping's whole purpose was to be trusted verbatim by a skill. A session
following it produced an error, and nothing about the file admitted it might.

**Nothing in this repo ever used the four names**, outside this file describing
them, which is why it went unnoticed: a mapping with no callers cannot fail
loudly. `docs/agents/issue-tracker.md` had already spotted it and carried the
correction in passing; this file, the one a skill is pointed at, still read as
current. The fix is here rather than there.

**Not fixed by creating the four labels.** A label nobody applies is the same
defect wearing the opposite clothes — `issue-tracker.md` says plainly that "a
declared label nobody maintains is exactly how `triage-labels.md` came to
describe four labels that do not exist", so creating four more unmaintained
ones would reproduce it rather than resolve it. If a triage state turns out to
be genuinely wanted, create the label at the moment it is first applied.

## Why there is no check behind this

A check would have to ask GitHub what labels exist, which needs the network and
a token, and neither runner has either. So this is a rule held by prose, which
this repo normally treats as the weak form.

**What limits the damage is the shortness of the list.** The previous version
failed because it named five labels, four of which nothing used — a claim with
no consumer to break. One label, which the steward applies and reads constantly,
is checked by being used every day. If this file ever grows a second name that
nothing applies, that name is wrong until proven otherwise.
