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
