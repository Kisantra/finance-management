"""Efek suara + musik latar tutorial hasil sintesis (bebas lisensi).

Jalankan: python remotion/sfx/generate.py
lalu ubah musik ke MP3 (lebih kecil):
  npx remotion ffmpeg -y -i remotion/sfx/music.wav -c:a libmp3lame -b:a 64k remotion/sfx/music.mp3 && rm remotion/sfx/music.wav

click.wav & whoosh.wav BUKAN dari skrip ini: rekaman CC0 dari @remotion/sfx (lihat index.tsx).
"""
import os
import wave

import numpy as np

SR = 44100
OUT = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(7)


def t(seconds):
    return np.arange(int(SR * seconds)) / SR


def lowpass(x, cutoff):
    """One-pole lowpass; cutoff boleh array (sweep)."""
    cutoff = np.broadcast_to(cutoff, x.shape)
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.zeros_like(x)
    prev = 0.0
    for i, v in enumerate(x):
        prev = (1 - a[i]) * v + a[i] * prev
        y[i] = prev
    return y


def save(name, x, peak_db=-3.0):
    fade = min(len(x) // 10, int(SR * 0.004))
    x[:fade] *= np.linspace(0, 1, fade)
    x[-fade:] *= np.linspace(1, 0, fade)
    x = x / np.max(np.abs(x)) * 10 ** (peak_db / 20)
    with wave.open(os.path.join(OUT, name), 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes((x * 32767).astype('<i2').tobytes())


def tick(length=0.018, bright=4500):
    n = rng.standard_normal(int(SR * length))
    n = n - lowpass(n, bright * 0.25)
    return lowpass(n, bright) * np.exp(-t(length) * 260)


# Mengetik: rangkaian ketukan tombol dengan jeda acak.
typing = np.zeros(int(SR * 2.0))
pos = int(SR * 0.01)
while pos < len(typing) - SR * 0.03:
    k = tick(0.022, rng.uniform(3200, 5200)) * rng.uniform(0.55, 1.0)
    typing[pos : pos + len(k)] += k
    pos += int(SR * rng.uniform(0.055, 0.11))
save('type.wav', typing, -6.0)

# Pop: kartu/elemen muncul.
x = t(0.12)
freq = 520 + 480 * np.exp(-x * 40)
pop = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-x * 38)
save('pop.wav', pop, -6.0)

# Berhasil: dua nada naik (E5 → B5) dengan harmonik lembut.
x = t(0.9)
success = np.zeros_like(x)
for start, f0 in ((0.0, 659.25), (0.11, 987.77)):
    y = np.clip(x - start, 0, None)
    on = (x >= start).astype(float)
    tone = np.sin(2 * np.pi * f0 * y) + 0.3 * np.sin(2 * np.pi * 2 * f0 * y)
    success += tone * np.exp(-y * 5.5) * on
save('success.wav', success, -4.0)

# Musik latar: pad akor lembut + nada lonceng pentatonik sesekali, 32 detik, berulang mulus.
MSR = 32000
LOOP = 32.0
CHORDS = [  # C · Am · F · G · C · Em · F · G (Hz)
    (130.81, 196.00, 246.94, 293.66, 329.63),
    (110.00, 164.81, 196.00, 246.94, 261.63),
    (87.31, 130.81, 164.81, 196.00, 220.00),
    (98.00, 146.83, 220.00, 261.63, 293.66),
    (130.81, 196.00, 246.94, 293.66, 329.63),
    (82.41, 123.47, 196.00, 246.94, 293.66),
    (87.31, 130.81, 164.81, 196.00, 220.00),
    (98.00, 146.83, 196.00, 246.94, 293.66),
]
BELLS = (523.25, 587.33, 659.25, 783.99, 880.00)
span = LOOP / len(CHORDS)
total = int(MSR * (LOOP + 6))
music = np.zeros(total)
for i, chord in enumerate(CHORDS):
    tt = np.arange(int(MSR * (span + 2.5))) / MSR
    env = np.minimum(1, tt / 1.4) * np.clip((span + 2.5 - tt) / 2.5, 0, 1)
    voice = np.zeros_like(tt)
    for k, f0 in enumerate(chord):
        voice += (np.sin(2 * np.pi * f0 * tt) + 0.5 * np.sin(2 * np.pi * (f0 + 0.35) * tt) + 0.12 * np.sin(4 * np.pi * f0 * tt)) / (1 + 0.35 * k)
    voice *= env * (1 + 0.08 * np.sin(2 * np.pi * 0.2 * tt))
    start = int(MSR * span * i)
    music[start : start + len(voice)] += voice
bell_rng = np.random.default_rng(3)
for step in range(int(LOOP / 2)):
    if bell_rng.random() < 0.55:
        tt = np.arange(int(MSR * 2.4)) / MSR
        f0 = bell_rng.choice(BELLS)
        bell = (np.sin(2 * np.pi * f0 * tt) + 0.2 * np.sin(2 * np.pi * 2.01 * f0 * tt)) * np.exp(-tt * 2.2) * 0.9
        start = int(MSR * (step * 2 + bell_rng.uniform(0, 0.4)))
        music[start : start + len(bell)] += bell
music = lowpass(music, 2200)
loop_len = int(MSR * LOOP)
music[: total - loop_len] += music[loop_len:]
music = music[:loop_len]
music = music / np.max(np.abs(music)) * 10 ** (-6 / 20)
with wave.open(os.path.join(OUT, 'music.wav'), 'wb') as f:
    f.setnchannels(1)
    f.setsampwidth(2)
    f.setframerate(MSR)
    f.writeframes((music * 32767).astype('<i2').tobytes())
print('ok')
