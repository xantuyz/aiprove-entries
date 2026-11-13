# Build transcript — AIProve 60s explainer video

Bounty: explainer-video-aiprove · Agent: 0x1d76956eFa87b148289862Be07451e7ef4406861
(handle muse.agent; entry id 36c466cf-11f9-4a45-8a2a-9ba3a81e8109, entered 13 Nov 2026 ~23:12 WIB)
Work dir: ~/workspace/aiprove/explainer-video-aiprove/

This transcript describes how the entry was built, for the bounty brief's
"transcript check applies to generated footage" rule. No secrets in this file.
(The Bearer token lives in .token, mode 600, and is never included here.)

## 1. Research (read-only)
- GET https://aiprove.fun/skill.md — auth + submission shapes (repo@commit+
  transcript OR prediction; submission with neither is rejected).
- GET https://aiprove.fun/api/bounties/explainer-video-aiprove — brief, prize
  5,000,000 PROVE, PosterJudge, closes 20 Nov 2026 13:49 UTC (20:49 WIB),
  12 submissions already, submitKind: "link".
- GET https://aiprove.fun/ (homepage) + /docs.html + /llms.txt — facts used in
  the script: free entry in open beta (no token, no hold; 100,000 PROVE credit
  switches on only at $PROVE fair-launch), graded in the open (published
  metric, sandbox runs each entry twice, public re-run), paid in tokenized
  stock / $PROVE / ETH.
- GET /api/bounties/explainer-video-aiprove/escrow — deployed: false,
  "pending deploy" (pre-launch caveat, disclosed in SUMMARY.md).

## 2. Auth + enter (free, no spend)
- node auth.js: GET /api/auth/challenge?address=... → EIP-191 personal_sign
  with the shared keypair → POST /api/auth/verify → Bearer token (.token).
  Note: first verify attempt failed "signature does not match address"; a
  clean retry succeeded (same code; the sibling NVDA worker hit the same
  one-off failure earlier the same day).
- POST /api/bounties/explainer-video-aiprove/enter {"handle":"muse.agent"}
  → entry id 36c466cf-11f9-4a45-8a2a-9ba3a81e8109.

## 3. Script + storyboard (original writing)
- script.md: 6-scene, 60-second script (~145 words), written from the brief
  and the facts above. No copy-paste from the site beyond short factual
  phrases ("free to enter", "graded in the open", "paid in stock").
- storyboard.md: shot list, timing, caption placement.

## 4. Generated footage (4 AI stills, media pipeline)
- scene2_waiting_room: idle robots in a dim waiting room, glowing board.
- scene3_arena: bright teal/gold bounty arena, giant task board.
- scene4_signing: robot hand signing with a glowing circuit key.
- scene5_trophy: golden trophy, stock certificates, glowing coins.
- All 1920×1280 webp, visually inspected: on-topic, no readable text inside
  the images (only illegible pseudo-text). Prompts recorded in SUMMARY.md.
- Title card + CTA card designed locally with PIL (DejaVu Sans, navy/teal/gold).

## 5. Assembly (ffmpeg, reproducible)
- python3 build_video.py → per-scene 10 s segments (zoompan Ken Burns
  1.00→1.08, drawtext captions with dark band, 0.5 s fades), concat to
  aiprove_explainer_60s.mp4 (1280×720, 30 fps, libx264, yuv420p).
- Verified with ffprobe (duration must read 60.00 s; see SUMMARY.md).
- No voiceover track: no TTS engine is installed in this environment
  (no espeak/festival/piper); the video is silent + captioned. Adding a
  voiceover later only needs an audio track mixed in; the script is written
  to be read aloud at ~145 wpm.
- No video-generation subagent call was used: the parent task did not state a
  video count, and the video tool requires a stated number for delegated work.
  The video was instead assembled from generated stills with ffmpeg.

## 6. Submission — BELUM SUBMIT (menunggu URL publik / repo)
- Bounty detail returns submitKind: "link" — sinyal bahwa bounty ini
  menerima submission berupa link (bukan repo). skill.md hanya mendokumentasi
  repoUrl+commit+transcript ATAU prediction, dan JS situs tidak menunjukkan
  form submit link, jadi nama field yang diterima server ("link") BELUM
  terverifikasi — percobaan submit dengan URL asli akan membuktikannya
  (diterima / ditolak), dan bila ditolak fallback-nya repo publik.
- Percobaan hosting video via Muse remote-storage GAGAL: upload butuh
  persetujuan egress; approval kedaluwarsa (approval_expired,
  approval_id connector-attempt-a714128a..., 14 Nov 2026 ~00:09 WIB);
  file TIDAK ter-upload. TIDAK di-retry (percobaan ulang akan memicu kartu
  persetujuan yang sama tanpa user yang menyetujui; upload ke file host
  pihak ketiga lain butuh persetujuan eksplisit — tidak ada).
- Yang kurang untuk submit: (1) URL publik video (koordinator: setujui
  upload remote-storage, atau hosting lain) LALU submit {"link": url,
  "handle": "muse.agent", "transcript": <isi transcript.md>}; ATAU (2) repo
  GitHub publik berisi video + script + transcript (keputusan parent),
  lalu submit {"repoUrl", "commit", "transcript"}.
- Diverifikasi: /api/me/submissions belum berisi submission apa pun untuk
  slug ini dari address ini (tidak ada submit duplikat/palsu).
