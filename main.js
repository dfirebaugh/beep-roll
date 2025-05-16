const noteFreq = {
  REST: null,
  A2: 110,
  As2: 117,
  Bf2: 117,
  B2: 123,
  C3: 131,
  Cs3: 139,
  Df3: 139,
  D3: 147,
  Ds3: 156,
  Ef3: 156,
  E3: 165,
  F3: 175,
  Fs3: 185,
  Gf3: 185,
  G3: 196,
  Gs3: 208,
  Af3: 208,
  A3: 220,
  As3: 233,
  Bf3: 233,
  B3: 247,
  C4: 262,
  Cs4: 277,
  Df4: 277,
  D4: 294,
  Ds4: 311,
  Ef4: 311,
  E4: 330,
  F4: 349,
  Fs4: 370,
  Gf4: 370,
  G4: 392,
  Gs4: 415,
  Af4: 415,
  A4: 440,
  As4: 466,
  Bf4: 466,
  B4: 494,
  C5: 523,
  Cs5: 554,
  Df5: 554,
  D5: 587,
  Ds5: 622,
  Ef5: 622,
  E5: 659,
  F5: 698,
  Fs5: 740,
  Gf5: 740,
  G5: 784,
  Gs5: 831,
  Af5: 831,
  A5: 880,
  As5: 932,
  Bf5: 932,
  B5: 988,
  C6: 1047,
  Cs6: 1109,
  Df6: 1109,
  D6: 1175,
  Ds6: 1245,
  Ef6: 1245,
  E6: 1319,
  F6: 1397,
  Fs6: 1480,
  Gf6: 1480,
  G6: 1568,
  Gs6: 1661,
  Af6: 1661,
  A6: 1760,
  As6: 1865,
  Bf6: 1865,
  B6: 1976,
  C7: 2093,
  Cs7: 2217,
  Df7: 2217,
  D7: 2349,
  Ds7: 2489,
  Ef7: 2489,
  E7: 2637,
  F7: 2794,
  Fs7: 2960,
  Gf7: 2960,
  G7: 3322,
  Gs7: 3729,
  Af7: 3729,
  A7: 4435,
  As7: 4699,
  Bf7: 4699,
  B7: 4978,
  C8: 5920,
  Cs8: 6645,
  Df8: 6645,
  D8: 7459,
  Ds8: 7902,
  Ef8: 7902,
};

const durationDefs = {
  whole_note: 2000,
  half_note: 2000 / 2,
  quarter_note: 2000 / 4,
  dotted_quarter: (3 * 2000) / 8,
  eighth_note: 2000 / 8,
  sixteenth_note: 2000 / 16,
  thirtysecond_note: 2000 / 32,
};

let audioCtx = null;
let masterGain = null;
let activeOscs = [];
let highlightTimers = [];

const macros = {
  kick_drum: "{ NOTE_A2, 10 }",
  snare_drum: "{ NOTE_B6, 10 }",
};

function expandMacrosWithOffsets(text) {
  const macros = {
    kick_drum: "{ NOTE_A2, 10 }",
    snare_drum: "{ NOTE_B6, 10 }",
  };

  let offsetMap = [];
  let result = "";
  let lastIndex = 0;
  let match;
  const re = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;

  while ((match = re.exec(text))) {
    const macroName = match[1];
    const macroValue = macros[macroName];
    const before = text.slice(lastIndex, match.index);
    result += before;

    const insertStart = result.length;

    if (macroValue) {
      result += macroValue;

      offsetMap.push({
        originalStart: match.index,
        originalEnd: re.lastIndex,
        newStart: insertStart,
        newEnd: insertStart + macroValue.length,
        isMacro: true,
      });
    } else {
      result += macroName;
    }

    lastIndex = re.lastIndex;
  }

  result += text.slice(lastIndex);
  return { expanded: result, offsetMap };
}

function parseSequence(text) {
  const { expanded, offsetMap } = expandMacrosWithOffsets(text);
  const seq = [];
  const re =
    /\{\s*NOTE_([A-G][sf]?\d|REST)\s*,\s*([a-zA-Z_][a-zA-Z0-9_]*|\d+)\s*,?\s*\}/g;
  let m;
  while ((m = re.exec(expanded))) {
    const name = m[1];
    const durRaw = m[2];

    const dur = durationDefs.hasOwnProperty(durRaw)
      ? durationDefs[durRaw]
      : parseInt(durRaw, 10);

    const freq = noteFreq[name] !== undefined ? noteFreq[name] : null;

    let start = m.index;
    let end = re.lastIndex;

    for (const map of offsetMap) {
      if (start >= map.newStart && start < map.newEnd) {
        start = map.originalStart;
        end = map.originalEnd;
        break;
      }
    }

    seq.push({ freq, dur, start, end });
  }
  return seq;
}

function stopSequence() {
  activeOscs.forEach((osc) => {
    try {
      osc.stop();
    } catch {}
  });
  activeOscs = [];

  highlightTimers.forEach(clearTimeout);
  highlightTimers = [];

  if (audioCtx) {
    audioCtx.close();
    audioCtx = masterGain = null;
  }
}

function playSequence(seq, volume) {
  stopSequence();

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.setValueAtTime(volume, audioCtx.currentTime);
  masterGain.connect(audioCtx.destination);

  const textarea = document.getElementById("noteList");
  let t = audioCtx.currentTime;

  seq.forEach(({ freq, dur, start, end }) => {
    if (freq !== null) {
      const osc = audioCtx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, t);
      osc.connect(masterGain);
      osc.start(t);
      osc.stop(t + dur / 1000);
      activeOscs.push(osc);
    }

    const delay = t - audioCtx.currentTime;

    const timeoutId = setTimeout(() => {
      const txt = textarea.value;
      const lineStart = txt.lastIndexOf("\n", start - 1) + 1;

      let lineEnd = txt.indexOf("\n", lineStart);
      if (lineEnd === -1) lineEnd = txt.length;

      textarea.setSelectionRange(lineStart, lineEnd);

      const lineNumber = txt.slice(0, lineStart).split("\n").length;
      const lineHeight = 20;
      const targetScroll =
        (lineNumber - 1) * lineHeight - textarea.clientHeight / 2;
      textarea.scrollTop = Math.max(0, targetScroll);
    }, delay * 1000);

    highlightTimers.push(timeoutId);

    t += dur / 1000;
  });
}

const playBtn = document.getElementById("playBtn");
const stopBtn = document.getElementById("stopBtn");
const volumeCtl = document.getElementById("volume");

playBtn.addEventListener("click", () => {
  const textarea = document.getElementById("noteList");
  textarea.focus();
  const text = textarea.value;
  const seq = parseSequence(text);
  const vol = parseFloat(volumeCtl.value);
  playSequence(seq, vol);
});

stopBtn.addEventListener("click", stopSequence);

volumeCtl.addEventListener("input", () => {
  const vol = parseFloat(volumeCtl.value);
  if (masterGain) {
    masterGain.gain.setValueAtTime(vol, audioCtx.currentTime);
  }
});
