# Generate the intro voice

The two clips in `assets/audio/` were generated with Kokoro (open, runs
locally, no key): `kokoro-onnx` with the v1.0 model, voice `af_heart`, speed
1.0, then trimmed at -50 dB and loudnorm-matched to `voice-play-loser.mp3`
(-19.6 LUFS, -1.5 dB true peak), mono 44.1 kHz 128 kbps. Other voices tried:
`af_bella`, `af_nicole`, `bf_emma`. If a clip is missing, the site falls back to
browser speech. No API key or API call belongs in the site.

The OpenAI route below is an alternative.

On a local machine with Python 3, ffmpeg and an OpenAI API key securely exported
as `OPENAI_API_KEY`, run from the repository root:

```sh
python3 scripts/generate-intro-voice.py
```

The script uses `gpt-4o-mini-tts`, voice `nova`, speed `1.0`, WAV intermediate
output, and the same warm/calm/medium-pace instructions for these exact lines:

- `Okay. Playing Loser, by Tame Impala.` → `assets/audio/ai-playing-loser.mp3`
- `Complete. Have a good day, Jeffrey.` → `assets/audio/ai-complete.mp3`

It asks for a short pause after the opening word, trims only leading/trailing
silence at -50 dB, and uses two-pass loudnorm matched to the measured integrated
loudness of `voice-play-loser.mp3`, with a -1.5 dB true-peak target. Output is mono,
44.1 kHz, 128 kbps MP3. Existing outputs are never overwritten. Inspect the printed
final loudness measurements and listen to both clips before committing them.

Play `?intro`, check both voices against the music, verify the first line ends
before Loser starts, and try Skip/Esc during each line. Browser tests with temporary
one-second audio fixtures validate the playback plumbing, not the final voice or
its perceptual mix. Commit both generated MP3s on a branch, merge and push normally.
