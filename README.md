EgoMatrix Reconstruction Lab — interactive research preview

Independent reproduction showcase, as of 2026-10-25. Not an official EgoMatrix author release.

Contents: four complete TACO RGB sequences (249, 200, 209, 260 frames); synchronized 30 Hz original video; interactive Three.js scenes displaying predicted MANO 778-vertex meshes and reconstructed object geometry; A1, Scene, A2, A3, aligned-depth teacher and paper-fixed-object variants; full-stage comparison videos and actual short-horizon policy failures. GT used only for offline scoring. The 260-frame sequence has no reliable 262-row GT alignment, so dynamics are N/A.

For transfer, mesh tracks are stored every other frame and interpolated in-browser. Original 30 Hz RGB is retained. No raw GT, credentials, or absolute local paths are included in public assets.

Source evidence stays in private working area: FIRST_FULL_BASELINE_STATUS_20261024.md and ALIGNED_TEACHER_THREE_FULL_CHAIN_SUMMARY_20261025.md. This site is a dated snapshot; it does not automatically follow the formal PPO run.

Run locally: python3 -m http.server 8766 in the directory, then visit http://localhost:8766 . ES modules need HTTP rather than file:// .

Original TACO data belongs to dataset creators. Paper: https://spikew726.github.io/EgoMatrix/ . Anonymous candidate implementation: https://github.com/EgoMatrix2027/EgoMatrix . Attribution to named paper authors has not been confirmed.

## XHand Retargeting preview
The 3D Explorer now offers a separate **XHand Retarget** view with the actual saved 60 Hz `opt_*` joint and wrist reference arrays (497/399/417 frames across three GT-evaluable samples). Robot link geometry comes from saved public XHand URDF visual meshes, with full-frame forward kinematics verified against saved 18-link center positions (maximum observed error 0.048 mm). The source video runs at 30 Hz; robot reference and interpolated link poses are synchronized to the same timestamp. Use `?mode=robot#stir` to open the robot view. Baseline, paper-fixed cut and aligned-teacher references remain separate. There is no retargeting reference for alternate brush260.

**Retargeting is not PPO.** These robot frames are offline target trajectories. The policy evaluation video remains separate and shows early termination after 9 control steps in the saved experiments. A full-length robot target is not a successful physical rollout.

## Actual Isaac Sim PPO execution — independently replayable 3D evidence

The PPO Actual Execution mode displays *recorded physical states*, not an imagined policy success. The three cases have exactly one recorded seed-0 episode apiece, with nine control steps and **no complete task success**: Stir uses native epoch-2000 checkpoint; Cut and Brush use independent aligned-teacher one-epoch API diagnostics.

We export the initial physics state at t=0 and the 9 completed control_post records (10 states at 60Hz through t=0.15s). Link poses are reconstructed directly from IsaacLab's body state and name mapping. Object poses come from the actual rigid-body state. A wireframe shows the reward-aligned XHand retarget reference (control step k compares against reference index k−1). Independent tip-position checks recover the saved first-nine-step mean errors: Stir LH 60.619 / RH 70.613 mm, Cut LH 60.134 / RH 65.896 mm, Brush LH 48.314 / RH 35.783 mm. Explicit failure reasons, physical timestamps and the shortened playback limit distinguish this from the full 60Hz reference. Direct link: `?mode=policy#stir`.

## Safety audit scope, not invented pass rates

The interactive timeline reads the saved native swept-audit outputs. The per-time color combines both hand tracks: Fail takes precedence, then Pass, then N/A. Numerical counts refer to individual hand/edge pairs. A gray N/A edge was geometrically measured but the native swept decision rule did not apply; it may contain significant penetration. Negative signed distances are preserved, along with native accepted limits. Historical candidate A3, cut paper-fixed A3, and aligned-teacher A3 are independently indexed. No new optimization or GT lookup was run for this site.

## Dataset and asset inventory

This snapshot contains 4 original full TACO RGB sequences, 7 distinct complete XHand retarget reference variants, 3 actual short PPO traces, and 8 native A3 safety-audit branches. Full evaluation metrics are kept stage-specific. Public build assets contain no raw GT, SSH credentials, model checkpoint weights, or private absolute file paths.
