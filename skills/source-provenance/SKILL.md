---
name: source-provenance
description: Organize asset origin, redistribution evidence, license notices and native-media provenance for a template or commercial library. Use for asset ingestion, source packaging and requested rights/provenance review.
---

# Source and provenance

Create a per-file ledger separating original authored code, adapted third-party code, generated media, stock media, fonts and vendors. Record origin URL/revision, author, exact license evidence, intended use and notices. Commercial end-project use and reselling source/media in a template library require separate scope decisions.

Use `review_licensing` and `audit_dependencies` with actual evidence. An MIT repository can contain separately restricted fonts, photography, video or models. Preserve applicable copyright/license text and identify adaptations; do not relicense a third party's MIT source as exclusively owned MotionVault code.

React Bits uses MIT + Commons Clause: treat it as interaction research for MotionVault, and exclude its components, bundles and ports from commercial downloadable templates. Public Scrolltide/MotionSites previews can guide motion analysis; they do not grant source or media redistribution rights. Do not ingest paywalled prompts or copied branded media.

For generated assets, retain provider/model/job IDs and prompt records. Read current provider terms for downstream distribution and provenance obligations. Where native output must survive, compare native/distributed SHA-256 and preserve exact files. Use `check_media_provenance` with measured hashes. Matching bytes or a marker alone does not validate a C2PA credential chain, copyright ownership or non-infringement. Do not transplant signature bytes into derivatives.

Keep unresolved rights or provenance restrictions explicit. Do not turn a model's commercial-use terms into an originality, exclusivity or universal legal guarantee. Refer consequential unresolved interpretation to the operator or qualified counsel.
