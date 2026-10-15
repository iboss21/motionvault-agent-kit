---
name: motion-director
description: Author or diagnose scroll choreography, easing, camera crops, responsive motion, and real GLSL effects for a cinematic website. Use when a site feels static, transitions fail, or a motion system needs implementation.
---

# Motion director

Use the MotionVault MCP tools for storyboard/timing calculations, easing samples, cover-crop geometry, contrast estimates, working pinned-scroll scaffolds, and GLSL generation. Read their returned constraints and distinguish a code scaffold from finished art direction.

Inspect the actual page/media before proposing changes. Separate page-scroll position, embedded preview scroll, recorded video time, and animated-GIF elapsed time. A prerecorded public preview demonstrates visual states but does not expose its original scroll distances or implementation.

Define a scene graph with named media, foreground/mask, type, navigation, and action layers. Give every transition a visible purpose. Prefer normalized progress for reversible scrubbing; preserve native touch/keyboard behavior and release at the story end.

Keep the scene timeline shared between preview and source. Observe pointer geometry relative to the correct stage, cap GPU pixel ratio, clean up render contexts/listeners, and stop autonomous animation when paused or reduced motion is requested.

Verify five progress frames, reverse playback, responsive crops, decoding readiness, and the final handoff to useful page content. Calculated contrast over flat colors does not prove legibility over a moving image; inspect real frames.
