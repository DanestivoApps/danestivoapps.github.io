"""Compose and render the soundtrack: a piano/strings anime ballad + synthesized SFX.

Usage: python3 compose.py SOUNDFONT.sf2 WORK_DIR OUT.wav

Timeline (80 BPM, one bar = 3 s, 20 bars = 60 s) follows the shot list in js/film.js:
  0-12   intro, piano alone (royal road IV-V-iii-vi)       sky -> riverside
  12-24  verse: melody + soft strings; crossing bells/train
  24-35  build: cello, light drums, snare roll -> cut at 35.0
  35-36  silence + heartbeat ("suki desu" subtitle)
  36-51  chorus: full piano octaves, strings, cymbals        confession -> finale
  51-60  resolution on Dmaj9, celesta; title card, fade out
"""
import os
import subprocess
import sys

import mido
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
BPM = 80
TPB = 480
SPB = 60.0 / BPM          # seconds per beat
BAR = 4 * SPB             # 3 s


def tick(sec):
    return int(round(sec / SPB * TPB))


NOTE_IDX = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7,
            'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def n(name):
    """'F#5' -> midi number."""
    if name[1] in '#b':
        p, o = name[:2], int(name[2:])
    else:
        p, o = name[0], int(name[1:])
    return 12 * (o + 1) + NOTE_IDX[p]


CHORD = {
    'Gmaj7': (['G2'], ['D3', 'F#3', 'A3', 'B3']), 'A': (['A2'], ['E3', 'A3', 'C#4', 'E4']),
    'A6': (['A2'], ['E3', 'F#3', 'A3', 'C#4']), 'F#m7': (['F#2'], ['C#3', 'E3', 'A3', 'C#4']),
    'Bm7': (['B1'], ['F#2', 'A2', 'D3', 'F#3']), 'Em7': (['E2'], ['B2', 'D3', 'G3', 'B3']),
    'A7sus4': (['A2'], ['E3', 'G3', 'A3', 'D4']), 'A7': (['A2'], ['E3', 'G3', 'A3', 'C#4']),
    'B7': (['B1'], ['F#2', 'A2', 'D#3', 'F#3']), 'Dmaj9': (['D2'], ['A2', 'C#3', 'E3', 'F#3']),
    'G/D': (['D2'], ['G2', 'B2', 'D3', 'G3']), 'A/G': (['G2'], ['E3', 'A3', 'C#4', 'E4']),
}

# bar (1-based) -> list of (chord, beat_start, beats)
PROG = {
    1: [('Gmaj7', 0, 4)], 2: [('A', 0, 4)], 3: [('F#m7', 0, 4)], 4: [('Bm7', 0, 4)],
    5: [('Gmaj7', 0, 4)], 6: [('A6', 0, 4)], 7: [('F#m7', 0, 4)], 8: [('Em7', 0, 2), ('A7sus4', 2, 1), ('A7', 3, 1)],
    9: [('Gmaj7', 0, 4)], 10: [('A/G', 0, 4)], 11: [('F#m7', 0, 2), ('B7', 2, 2)], 12: [('Em7', 0, 2), ('A7sus4', 2, 0.667)],
    13: [('Gmaj7', 0, 4)], 14: [('A', 0, 4)], 15: [('F#m7', 0, 4)], 16: [('Bm7', 0, 4)],
    17: [('Em7', 0, 2), ('A7sus4', 2, 1), ('A7', 3, 1)], 18: [('Dmaj9', 0, 4)], 19: [('G/D', 0, 4)], 20: [('Dmaj9', 0, 4)],
}

MELODY = {
    5: [(0, 1, 'B4'), (1, 1, 'D5'), (2, 2, 'F#5')],
    6: [(0, 1.5, 'E5'), (1.5, 0.5, 'D5'), (2, 1, 'C#5'), (3, 1, 'A4')],
    7: [(0, 1, 'A4'), (1, 1, 'C#5'), (2, 2, 'E5')],
    8: [(0, 1, 'D5'), (1, 0.5, 'E5'), (1.5, 0.5, 'F#5'), (2, 2, 'E5')],
    9: [(0, 1.5, 'F#5'), (1.5, 0.5, 'G5'), (2, 1, 'A5'), (3, 1, 'D5')],
    10: [(0, 1, 'G5'), (1, 1, 'F#5'), (2, 1, 'E5'), (3, 1, 'C#5')],
    11: [(0, 1.5, 'C#5'), (1.5, 0.5, 'D5'), (2, 1, 'D#5'), (3, 1, 'F#5')],
    12: [(0, 2, 'G5'), (2, 0.667, 'A5')],
    13: [(0, 1, 'F#5'), (1, 1, 'A5'), (2, 2, 'D6')],
    14: [(0, 1, 'C#6'), (1, 1, 'B5'), (2, 1, 'A5'), (3, 1, 'E5')],
    15: [(0, 2, 'A5'), (2, 1, 'C#6'), (3, 1, 'B5')],
    16: [(0, 3, 'B5'), (3, 0.5, 'A5'), (3.5, 0.5, 'F#5')],
    17: [(0, 1, 'G5'), (1, 1, 'F#5'), (2, 1, 'E5'), (3, 1, 'A5')],
    18: [(0, 4, 'F#5')],
    19: [(0, 2, 'E5'), (2, 2, 'D5')],
    20: [(0, 4, 'D5')],
}

CUT = 35.0  # everything stops: the confession lands in silence
rng = np.random.default_rng(3)


class Track:
    def __init__(self, ch, program, name):
        self.ch, self.events, self.name = ch, [], name
        self.events.append((0, mido.Message('program_change', channel=ch, program=program, time=0)))

    def note(self, start, dur, pitch, vel):
        if start >= CUT - 0.01 and start < 36.0 - 0.01:
            return
        end = start + dur
        if start < CUT < end:
            end = CUT
        vel = int(np.clip(vel + rng.integers(-4, 5), 1, 127))
        self.events.append((tick(start), mido.Message('note_on', channel=self.ch, note=pitch, velocity=vel, time=0)))
        self.events.append((tick(end) - 1, mido.Message('note_off', channel=self.ch, note=pitch, velocity=0, time=0)))

    def cc(self, t, num, val):
        self.events.append((tick(t), mido.Message('control_change', channel=self.ch, control=num, value=int(np.clip(val, 0, 127)), time=0)))

    def ramp(self, t0, t1, num, v0, v1, steps=24):
        for i in range(steps + 1):
            k = i / steps
            self.cc(t0 + (t1 - t0) * k, num, v0 + (v1 - v0) * k)

    def to_midi(self):
        tr = mido.MidiTrack()
        tr.append(mido.MetaMessage('track_name', name=self.name, time=0))
        ev = sorted(self.events, key=lambda e: (e[0], 0 if e[1].type == 'note_off' else 1))
        last = 0
        for t, m in ev:
            tr.append(m.copy(time=max(0, t - last)))
            last = max(last, t)
        return tr


def bar_t(bar, beat=0.0):
    return (bar - 1) * BAR + beat * SPB


def compose(path):
    piano = Track(0, 0, 'Piano')
    strings = Track(1, 49, 'Strings')     # slow strings
    pad = Track(2, 89, 'Pad')             # warm pad
    cello = Track(3, 42, 'Cello')
    celesta = Track(4, 8, 'Celesta')
    harp = Track(5, 46, 'Harp')
    melo_str = Track(6, 48, 'StringsMelody')
    drums = Track(9, 0, 'Drums')
    tracks = [piano, strings, pad, cello, celesta, harp, melo_str, drums]
    for tr in tracks:
        tr.cc(0, 91, 90)   # reverb send
        tr.cc(0, 93, 30)   # chorus send
        tr.cc(0, 7, 100)
    piano.cc(0, 91, 75)
    drums.cc(0, 91, 60)

    # --- piano left hand arpeggios + pedal
    for bar, chords in PROG.items():
        for name, b0, beats in chords:
            bass, upper = CHORD[name]
            start = bar_t(bar, b0)
            piano.cc(start - 0.02, 64, 0)
            piano.cc(start + 0.02, 64, 100)
            loud = 1.0 if bar < 13 else 1.25
            if bar >= 18:
                loud = 1.0
            pattern = [n(bass[0]), n(upper[0]) , n(upper[1]) + 12 if bar >= 13 else n(upper[1]), n(upper[2]),
                       n(upper[3]), n(upper[2]), n(upper[1]), n(upper[0])]
            steps = int(round(beats * 2))
            for k in range(steps):
                t = start + k * SPB / 2
                p = pattern[k % 8]
                v = (52 if k % 4 == 0 else 40) * loud
                if bar <= 4:
                    v *= 1.2
                piano.note(t, SPB * 1.6, p, v)
            if bar >= 13 and bar <= 17:
                piano.note(start, beats * SPB, n(bass[0]) - 12, 60)   # low octave in the chorus
    # final chord ring-out
    piano.cc(bar_t(20, 3.9), 64, 0)

    # --- melody
    for bar, notes in MELODY.items():
        for b0, beats, name in notes:
            t = bar_t(bar, b0)
            p = n(name)
            if bar < 13:
                piano.note(t, beats * SPB, p, 70)
            elif bar < 18:
                piano.note(t, beats * SPB, p, 82)
                piano.note(t, beats * SPB, p - 12, 66)
                melo_str.note(t, beats * SPB * 1.02, p - 12, 76)
            else:
                piano.note(t, beats * SPB, p, 64)
                piano.note(t, beats * SPB, p - 12, 50)
    melo_str.ramp(36.0, 37.0, 11, 70, 110)
    melo_str.ramp(48.0, 54.0, 11, 110, 60)

    # --- strings pad
    for bar, chords in PROG.items():
        if bar < 5:
            continue
        for name, b0, beats in chords:
            _, upper = CHORD[name]
            t = bar_t(bar, b0)
            for p in upper:
                strings.note(t, beats * SPB + 0.05, n(p) + 12, 58 if bar < 13 else 78)
    strings.ramp(12.0, 15.0, 11, 30, 80)
    strings.ramp(20.0, 23.5, 11, 80, 55)       # make room for the train
    strings.ramp(24.0, 27.0, 11, 55, 85)
    strings.ramp(31.5, 35.0, 11, 85, 120)      # build to the cut
    strings.cc(35.0, 11, 60)
    strings.ramp(36.0, 37.5, 11, 70, 115)
    strings.ramp(54.0, 59.5, 11, 110, 20)

    # --- warm pad under everything
    for bar, chords in PROG.items():
        for name, b0, beats in chords:
            bass, upper = CHORD[name]
            t = bar_t(bar, b0)
            for p in [bass[0]] + upper[:3]:
                pad.note(t, beats * SPB + 0.1, n(p) + 12, 45)
    pad.ramp(0, 4.0, 11, 0, 88)
    pad.ramp(56, 60, 11, 70, 0)

    # --- cello roots from the build onward
    for bar, chords in PROG.items():
        if bar < 9:
            continue
        for name, b0, beats in chords:
            bass, _ = CHORD[name]
            t = bar_t(bar, b0)
            cello.note(t, beats * SPB, n(bass[0]) + 12 if n(bass[0]) < 40 else n(bass[0]), 70 if bar < 13 else 88)
    cello.ramp(24, 27, 11, 40, 100)

    # --- celesta sparkles
    def sparkle(t, notes, step=0.09, vel=60):
        for i, nm in enumerate(notes):
            celesta.note(t + i * step, 1.2, n(nm), vel - i * 2)
    sparkle(0.2, ['A5', 'C#6', 'F#6', 'A6', 'D7'], 0.12, 50)
    sparkle(12.0, ['D6', 'F#6', 'A6', 'C#7'], 0.1, 46)
    sparkle(33.4, ['A6', 'D7', 'F#7', 'A7'], 0.07, 58)       # the shadows' hands meet
    for bar in range(13, 18):
        chords = PROG[bar]
        _, upper = CHORD[chords[0][0]]
        sparkle(bar_t(bar, 2.5), [upper[1][:-1] + '6', upper[2][:-1] + '6', upper[3][:-1] + '6'], 0.12, 42)
    sparkle(49.1, ['E7', 'C#7', 'A6', 'E6', 'C#6'], 0.06, 55)  # shooting star (descending)
    sparkle(52.2, ['D6', 'F#6', 'A6', 'C#7', 'E7'], 0.13, 56)  # title
    sparkle(53.6, ['A6', 'C#7', 'E7', 'F#7'], 0.06, 50)
    sparkle(57.0, ['F#6', 'A6', 'D7'], 0.25, 40)

    # --- harp glissandi on scene changes
    def gliss(t, lo, hi, dur, up=True, vel=55):
        scale = [0, 2, 4, 6, 7, 9, 11]  # D major (relative to D)
        notes = []
        for o in range(1, 8):
            for s in scale:
                p = 12 * o + 2 + s
                if lo <= p <= hi:
                    notes.append(p)
        if not up:
            notes = notes[::-1]
        for i, p in enumerate(notes):
            harp.note(t + dur * i / len(notes), 1.5, p, vel)
    gliss(11.2, n('D4'), n('A6'), 0.8)
    gliss(26.5, n('A4'), n('D7'), 0.6, vel=48)
    gliss(43.6, n('D4'), n('F#7'), 0.65, up=True, vel=62)
    gliss(50.6, n('A3'), n('D6'), 0.9, vel=50)

    # --- drums: soft groove in the build, fuller in the chorus
    K, S, HH, RIDE, CRASH, SN2 = 36, 38, 42, 51, 49, 40
    for bar in (10, 11):
        for beat in (0, 2.5):
            drums.note(bar_t(bar, beat), 0.2, K, 48)
        for e in range(8):
            drums.note(bar_t(bar, e * 0.5), 0.1, HH, 22 + (8 if e % 2 == 0 else 0))
    # snare roll building into the cut
    t = bar_t(12, 0)
    while t < CUT - 0.01:
        k = (t - bar_t(12, 0)) / (CUT - bar_t(12, 0))
        drums.note(t, 0.08, S, int(18 + 80 * k ** 1.6))
        t += SPB / 4 if k < 0.5 else SPB / 6
    for bar in range(13, 18):
        for beat in (0, 1.5, 2):
            drums.note(bar_t(bar, beat), 0.2, K, 72)
        for beat in (1, 3):
            drums.note(bar_t(bar, beat), 0.2, SN2, 52)
        for beat in range(4):
            drums.note(bar_t(bar, beat), 0.2, RIDE, 38)
    drums.note(36.0, 2.0, CRASH, 100)
    drums.note(45.0, 2.0, CRASH, 70)
    drums.note(bar_t(18, 0), 3.0, CRASH, 82)

    mid = mido.MidiFile(ticks_per_beat=TPB)
    meta = mido.MidiTrack()
    meta.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(BPM), time=0))
    mid.tracks.append(meta)
    for tr in tracks:
        mid.tracks.append(tr.to_midi())
    mid.save(path)


# ------------------------------------------------------------------ SFX
def t_arr(dur):
    return np.arange(int(dur * SR)) / SR


def pink(nsamp, seed):
    r = np.random.default_rng(seed)
    w = r.standard_normal(nsamp)
    b, a = [0.049922035, -0.095993537, 0.050612699, -0.004408786], [1, -2.494956002, 2.017265875, -0.522189400]
    return signal.lfilter(b, a, w)


def bandpass(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype='band', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def lowpass(x, f, order=2):
    sos = signal.butter(order, f, btype='low', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def env_points(times, vals, total):
    tt = np.arange(total) / SR
    return np.interp(tt, times, vals)


def add(mix, x, start, gain=1.0, pan=0.0):
    """x mono or stereo; pan -1..1 (constant power)."""
    i0 = int(start * SR)
    if x.ndim == 1:
        lg, rg = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * lg, x * rg], axis=1)
    i1 = min(len(mix), i0 + len(x))
    if i1 > i0:
        mix[i0:i1] += x[: i1 - i0] * gain


def wind(total):
    nL = bandpass(pink(total, 11), 180, 1400)
    nR = bandpass(pink(total, 12), 180, 1400)
    # gusts: slow modulation + scripted swells
    tt = np.arange(total) / SR
    mod = 0.55 + 0.25 * np.sin(tt * 0.7) + 0.2 * np.sin(tt * 1.9 + 1)
    script = env_points(
        [0, 2, 7.5, 13.5, 18, 20.25, 24, 27, 31.5, 34.4, 34.9, 35.6, 36.0, 37.5, 44.25, 51.5, 58, 60],
        [0.2, 0.6, 0.8, 1.0, 0.5, 0.4, 0.9, 0.7, 0.5, 0.6, 1.4, 0.9, 1.5, 0.8, 0.6, 0.35, 0.2, 0.0], total)
    e = mod * script
    x = np.stack([nL * e, nR * e * 0.95], axis=1)
    return x / (np.abs(x).max() + 1e-9)


def crossing_bell(dur, period=1 / 2.3):
    """Japanese crossing alarm: a bright electronic 'kan' repeating."""
    out = np.zeros(int(dur * SR))
    tt = t_arr(0.42)
    partials = [(760, 1.0), (1520 * 1.004, 0.45), (2280 * 0.996, 0.25), (3050, 0.12), (1140, 0.18)]
    hit = sum(a * np.sin(2 * np.pi * f * tt) for f, a in partials)
    hit *= np.exp(-tt * 9) * (1 - np.exp(-tt * 900))
    k = 0
    while k * period < dur:
        i0 = int(k * period * SR)
        seg = hit[: max(0, min(len(hit), len(out) - i0))]
        out[i0:i0 + len(seg)] += seg
        k += 1
    return out / np.abs(out).max()


def train_pass(dur, t_in=0.25, t_out=None, car_period=1006 / 3100):
    """Rumble + rail clacks, panned right -> left, brightening as it passes."""
    total = int(dur * SR)
    tt = np.arange(total) / SR
    rumble = lowpass(pink(total, 21), 420, 4) * 1.0 + bandpass(pink(total, 22), 500, 2500) * 0.35
    env = np.clip((tt - t_in) / 0.35, 0, 1) * np.clip((dur - 0.2 - tt) / 0.9, 0, 1)
    rumble *= env
    clack = np.zeros(total)
    th = t_arr(0.09)
    thump = np.sin(2 * np.pi * 90 * th) * np.exp(-th * 45) + bandpass(np.random.default_rng(5).standard_normal(len(th)), 800, 3000) * np.exp(-th * 80) * 0.6
    t = t_in + 0.05
    while t < dur - 0.6:
        for off in (0.0, 0.07, car_period * 0.72, car_period * 0.72 + 0.07):
            i0 = int((t + off) * SR)
            if i0 + len(thump) < total:
                clack[i0:i0 + len(thump)] += thump
        t += car_period
    x = rumble / (np.abs(rumble).max() + 1e-9) + clack * 0.55
    pan = np.clip(1.0 - 2.0 * (tt - t_in) / (dur - t_in), -1, 1)
    L = x * np.cos((pan + 1) * np.pi / 4)
    R = x * np.sin((pan + 1) * np.pi / 4)
    return np.stack([L, R], axis=1)


def riser(dur):
    total = int(dur * SR)
    tt = np.arange(total) / SR
    x = pink(total, 31)
    out = np.zeros(total)
    # sweep a band upward
    seg = 2048
    for i in range(0, total, seg):
        k = i / total
        f = 300 + 5000 * k ** 2
        chunk = bandpass(x[max(0, i - 4096):i + seg], f * 0.7, min(f * 1.4, SR / 2 - 100))[-min(seg, total - i):]
        out[i:i + len(chunk)] = chunk
    out *= (tt / dur) ** 2.2
    return out / (np.abs(out).max() + 1e-9)


def heartbeat():
    tt = t_arr(0.35)
    beat = np.sin(2 * np.pi * (55 - 15 * tt) * tt) * np.exp(-tt * 14) * (1 - np.exp(-tt * 300))
    out = np.zeros(int(0.9 * SR))
    for off, g in ((0.0, 1.0), (0.24, 0.7)):
        i0 = int(off * SR)
        out[i0:i0 + len(beat)] += beat * g
    return out / np.abs(out).max()


def shimmer(dur, seed=41):
    """Soft airy whoosh for the white flash."""
    total = int(dur * SR)
    tt = np.arange(total) / SR
    x = bandpass(pink(total, seed), 2000, 9000)
    e = np.sin(np.pi * np.clip(tt / dur, 0, 1)) ** 2
    return x * e / (np.abs(x * e).max() + 1e-9)


def main():
    sf2, work, out = sys.argv[1:4]
    os.makedirs(work, exist_ok=True)
    mid = os.path.join(work, 'music.mid')
    compose(mid)
    wav = os.path.join(work, 'music.wav')
    subprocess.run(['fluidsynth', '-ni', '-q', '-g', '0.55', '-r', str(SR), '-o', 'synth.reverb.room-size=0.75',
                    '-o', 'synth.reverb.width=0.9', '-o', 'synth.reverb.level=0.7', '-F', wav, sf2, mid], check=True)
    sr, music = wavfile.read(wav)
    music = music.astype(np.float64)
    music /= np.abs(music).max()
    total = int(60.5 * SR)
    mix = np.zeros((total, 2))
    add(mix, music[:total], 0, 0.82)
    # duck the music a little under the train
    duck = env_points([0, 20.2, 20.6, 23.2, 23.8, 61], [1, 1, 0.55, 0.55, 1, 1], total)
    mix *= duck[:, None]
    add(mix, wind(total), 0, 0.075)
    bell = crossing_bell(7.0)
    bell_env = env_points([0, 0.45, 2.0, 5.6, 6.2, 7.0], [0.0, 0.55, 1.0, 1.0, 0.28, 0.0], len(bell))
    bell_f = bell * bell_env
    # muffled once we cut to the boy's close-up
    k = int((24.0 - 17.4) * SR)
    bell_f[k:] = lowpass(bell_f[k:], 1800)
    add(mix, bell_f, 17.4, 0.16, pan=-0.25)
    add(mix, train_pass(3.4), 20.25, 0.42)
    add(mix, riser(1.0), 34.0, 0.12)
    add(mix, heartbeat(), 35.05, 0.35)
    add(mix, shimmer(1.2), 43.7, 0.08)
    add(mix, shimmer(1.6, 43), 50.9, 0.06)
    # master: gentle fade, peak normalise
    fade = env_points([0, 0.05, 58.3, 60.0, 61], [0, 1, 1, 0, 0], total)
    mix *= fade[:, None]
    mix /= np.abs(mix).max() / 0.89
    wavfile.write(out, SR, (mix[: int(60 * SR)] * 32767).astype(np.int16))
    print('wrote', out)


if __name__ == '__main__':
    main()
