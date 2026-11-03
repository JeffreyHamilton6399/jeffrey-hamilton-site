# Glyph Wind

Vendored from [Henry Fan's Claude Code Background Lab](https://github.com/Henry-fan88/claude-code-background),
`src/renderer.js` (blob `523efb978e5fd1d44c365d44c13a2737bf2c2ce1`).
MIT license; see LICENSE alongside this file.

Local integration changes expose `poke(id, x, y)` and `ripple(x, y)`, allow
the host pointer listeners to be disabled, and keep a separate movement
history for each intro cursor. The original glyph atlas, cloud/wind shaders,
blue ripples and every-third-click heart are preserved.

This is Henry Fan's original public reconstruction, not Anthropic source or
assets. It uses system monospace fonts. No runtime requests go to the source
repository.
