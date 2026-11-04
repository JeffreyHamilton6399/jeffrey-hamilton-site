#!/usr/bin/env python3
"""Run locally with OPENAI_API_KEY set, Python 3 and ffmpeg; no pip packages."""
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / 'assets/audio'
LINES = {
    'ai-playing-loser.mp3': 'Okay. Playing Loser, by Tame Impala.',
    'ai-complete.mp3': 'Complete. Have a good day, Jeffrey.',
}
STYLE = ('Speak in a warm, calm, modern assistant voice. Natural and understated, '
         'never robotic or theatrical. Medium conversational pace. Leave a short '
         'natural pause after Okay or Complete. Use the same delivery for both lines.')
TRIM = ('silenceremove=start_periods=1:start_duration=0.02:start_threshold=-50dB,'
        'areverse,silenceremove=start_periods=1:start_duration=0.02:'
        'start_threshold=-50dB,areverse')


def measure(path, filters):
    result = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(path), '-af', filters,
                             '-f', 'null', '-'], capture_output=True, text=True, check=True)
    return json.loads(re.findall(r'\{[^{}]+\}', result.stderr)[-1])


def main():
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        raise SystemExit('Set OPENAI_API_KEY securely in your local shell before running.')
    for name in LINES:
        if (AUDIO / name).exists():
            raise SystemExit('Refusing to overwrite existing ' + name)
    reference = measure(AUDIO / 'voice-play-loser.mp3', 'loudnorm=print_format=json')
    target = float(reference['input_i'])
    if not -70 <= target <= -5:
        raise SystemExit('Reference loudness is outside the supported range: ' + str(target))
    with tempfile.TemporaryDirectory() as temp:
        for name, text in LINES.items():
            request = Request('https://api.openai.com/v1/audio/speech',
                data=json.dumps({'model': 'gpt-4o-mini-tts', 'voice': 'nova',
                                 'input': text, 'instructions': STYLE,
                                 'response_format': 'wav', 'speed': 1.0}).encode(),
                headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
            raw = Path(temp) / (name + '.wav')
            with urlopen(request, timeout=120) as response:
                raw.write_bytes(response.read())
            base = TRIM + ',aformat=channel_layouts=mono,'
            settings = 'loudnorm=I=' + str(target) + ':TP=-1.5:LRA=7'
            stats = measure(raw, base + settings + ':print_format=json')
            measured = ':'.join(k + '=' + stats[v] for k, v in [
                ('measured_I', 'input_i'), ('measured_TP', 'input_tp'),
                ('measured_LRA', 'input_lra'), ('measured_thresh', 'input_thresh'),
                ('offset', 'target_offset')])
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-n',
                            '-i', str(raw), '-af', base + settings + ':' + measured + ':linear=true',
                            '-ac', '1', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '128k',
                            str(AUDIO / name)], check=True)
            print(name + ': ' + json.dumps(measure(AUDIO / name, 'loudnorm=print_format=json')))
    print('Listen to both clips and their music mixes before committing them.')


if __name__ == '__main__':
    main()
