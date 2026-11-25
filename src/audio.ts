type Cue = 'draw' | 'discard' | 'pair' | 'meld' | 'win'

let context: AudioContext | undefined
let output: GainNode | undefined

export function unlockAudio() {
  try {
    if (!context) {
      context = new AudioContext()
      output = context.createGain()
      output.connect(context.destination)
    }
    if (output) output.gain.value = 1
    if (context.state === 'suspended') void context.resume().catch(() => {})
  } catch {
    context = undefined
    output = undefined
  }
}

const notes: Record<Cue, [number, number, number, number, OscillatorType][]> = {
  draw: [[620, 0, .075, .07, 'sine']],
  discard: [[155, 0, .075, .15, 'triangle'], [390, .012, .05, .055, 'sine']],
  pair: [[523.25, 0, .13, .08, 'sine'], [783.99, .055, .145, .08, 'sine']],
  meld: [[146, 0, .083, .16, 'triangle'], [293.66, .024, .13, .08, 'triangle'],
    [587.33, .042, .18, .078, 'sine'], [880, .065, .16, .06, 'sine']],
  win: [[523.25, 0, .22, .10, 'sine'], [659.25, .075, .22, .09, 'sine'],
    [783.99, .15, .27, .09, 'sine'], [1046.5, .23, .36, .11, 'triangle']],
}

export function muteAudio() {
  if (output) output.gain.value = 0
}

export function play(cue: Cue, delay = 0) {
  if (!context || !output || context.state === 'closed') return
  const audio = context
  for (const [pitch, offset, duration, volume, type] of notes[cue]) {
    const start = audio.currentTime + delay + offset
    const tone = audio.createOscillator()
    const gain = audio.createGain()
    tone.type = type
    tone.frequency.value = pitch
    gain.gain.setValueAtTime(.001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + .008)
    gain.gain.exponentialRampToValueAtTime(.001, start + duration)
    tone.connect(gain).connect(output)
    tone.start(start)
    tone.stop(start + duration)
    tone.onended = () => { tone.disconnect(); gain.disconnect() }
  }
}
