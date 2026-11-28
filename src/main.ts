import './style.css'
import { muteAudio, play, unlockAudio } from './audio'
import { completedGroups, defaultDrawLimit, discard, drawLimits, held, startRound } from './game'
import type { Group, Round, Tile } from './game'

const hand = document.querySelector<HTMLDivElement>('#hand')!
const discards = document.querySelector<HTMLDivElement>('#discards')!
const remaining = document.querySelector('#remaining')!
const wins = document.querySelector('#wins')!
const status = document.querySelector('#status')!
const player = document.querySelector('#player')!
const legend = document.querySelector<HTMLDivElement>('#legend')!
const again = document.querySelector<HTMLButtonElement>('#again')!
const openSettings = document.querySelector<HTMLButtonElement>('#open-settings')!
const settings = document.querySelector<HTMLDialogElement>('#settings')!
const numerals = '一二三四五六七八九'
const tileSuits = [
  { id: 'man', label: '萬子', suffix: '萬' },
  { id: 'pin', label: '筒子', suffix: '筒' },
  { id: 'sou', label: '索子', suffix: '索' },
] as const
const tileImages = import.meta.glob<string>('./tiles/*.svg', {
  eager: true, query: '?url', import: 'default',
})
const storagePrefix = import.meta.env.MODE === 'pages-test'
  ? `mahjong5.test.pr-${import.meta.env.VITE_TEST_PR || 'local'}.`
  : 'mahjong5.'

function read(key: string) {
  try { return localStorage.getItem(storagePrefix + key) } catch { return null }
}

function save(key: string, value: string) {
  try { localStorage.setItem(storagePrefix + key, value) } catch {}
}

let totalWins = Number(read('wins'))
if (!Number.isSafeInteger(totalWins) || totalWins < 0) totalWins = 0
let soundOn = read('sound') !== 'off'
let drawLimit = drawLimits.find(limit => String(limit) === read('drawLimit')) ?? defaultDrawLimit
let tileSuit = tileSuits.find(suit => suit.id === read('tileSuit')) ?? tileSuits[0]
let round: Round

function renderSetting<T>(
  name: string,
  options: readonly T[],
  selected: T,
  label: (option: T) => string,
  onChange: (option: T) => void,
) {
  const group = document.getElementById(name)!
  group.replaceChildren(...options.map(option => {
    const choice = document.createElement('label')
    const input = document.createElement('input')
    input.type = 'radio'
    input.name = name
    input.checked = option === selected
    input.addEventListener('change', () => {
      if (input.checked) onChange(option)
    })
    choice.append(input, label(option))
    return choice
  }))
}

function updateTileFace(face: HTMLElement, image: HTMLImageElement, rank: number) {
  const name = numerals[rank - 1] + tileSuit.suffix
  face.setAttribute('aria-label', face instanceof HTMLButtonElement ? name + 'を捨てる' : name)
  image.src = tileImages[`./tiles/${tileSuit.id}${rank}.svg`]
}

function tileFace(tile: Tile, interactive = false) {
  const face = document.createElement(interactive ? 'button' : 'span')
  face.className = 'tile'
  face.dataset.id = String(tile.id)
  face.dataset.rank = String(tile.rank)
  if (face instanceof HTMLButtonElement) {
    face.type = 'button'
  } else {
    face.setAttribute('role', 'img')
  }
  const image = document.createElement('img')
  image.alt = ''
  image.draggable = false
  updateTileFace(face, image, tile.rank)
  face.append(image)
  return face
}

function renderHand(newGroups: Group[]) {
  const newPairs = new Set<number>()
  const newMelds = new Set<number>()
  for (const group of newGroups) {
    const members = group.kind === 'pair' ? newPairs : newMelds
    for (const tile of group.tiles) members.add(tile.id)
  }
  hand.classList.toggle('flash-both', newPairs.size > 0 && newMelds.size > 0)
  const meldIds = new Set(round.win?.meld.tiles.map(tile => tile.id))
  const pairIds = new Set(round.win?.pair.tiles.map(tile => tile.id))
  hand.replaceChildren(...held(round).map(tile => {
    const face = tileFace(tile, round.phase === 'playing')
    if (tile.id === round.drawn?.id) face.classList.add('drawn')
    if (newPairs.has(tile.id)) face.classList.add('flash-pair')
    if (newMelds.has(tile.id)) face.classList.add('flash-meld')
    if (meldIds.has(tile.id)) face.classList.add('win-meld')
    if (pairIds.has(tile.id)) face.classList.add('win-pair')
    return face
  }))
}

function showRound(previousGroups: Map<string, Group>, delay: number, playDraw: boolean) {
  const newGroups = [...completedGroups(held(round))]
    .filter(([key]) => !previousGroups.has(key)).map(([, group]) => group)

  if (round.phase === 'won') {
    totalWins++
    save('wins', String(totalWins))
  }
  remaining.textContent = String(round.phase === 'playing' ? round.remainingDraws : 0)
  wins.textContent = String(totalWins)
  status.textContent = round.phase === 'won' ? '和了！' : round.phase === 'draw' ? '流局' : ''
  player.classList.toggle('won', round.phase === 'won')
  legend.hidden = round.phase !== 'won'
  again.hidden = round.phase === 'playing'
  renderHand(newGroups)

  if (!soundOn) return
  if (round.drawn && playDraw) play('draw', delay)
  const newPair = newGroups.some(group => group.kind === 'pair')
  if (newPair) play('pair', delay + .13)
  if (newGroups.some(group => group.kind === 'meld')) play('meld', delay + (newPair ? .24 : .16))
  if (round.phase === 'won') play('win', delay + .36)
}

function newRound(playDraw: boolean) {
  round = startRound(undefined, drawLimit)
  discards.replaceChildren()
  showRound(new Map(), 0, playDraw)
}

function animateDiscard(face: HTMLElement, from: DOMRect) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const to = face.getBoundingClientRect()
  const flight = face.cloneNode(true) as HTMLElement
  flight.classList.add('flight')
  flight.setAttribute('aria-hidden', 'true')
  Object.assign(flight.style, {
    left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px',
    fontSize: getComputedStyle(face).fontSize,
  })
  document.body.append(flight)
  face.style.visibility = 'hidden'
  const animation = flight.animate([
    { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width})` },
    { transform: 'translate(0, 0) scale(1)' },
  ], { duration: 210, easing: 'cubic-bezier(.2,.72,.3,1)' })
  animation.onfinish = animation.oncancel = () => {
    face.style.visibility = ''
    flight.remove()
  }
}

hand.addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button.tile')
  if (!button || round.phase !== 'playing') return
  const index = [...hand.children].indexOf(button)
  const before = completedGroups(held(round))
  const from = button.getBoundingClientRect()
  const next = discard(round, Number(button.dataset.id))
  if (next === round) return
  round = next

  if (soundOn) {
    unlockAudio()
    play('discard', .15)
  }
  const face = tileFace(round.discards[round.discards.length - 1])
  discards.append(face)
  showRound(before, .16, true)
  animateDiscard(face, from)
  if (event.detail === 0) {
    const target = again.hidden ? hand.querySelectorAll('button')[index] : again
    target?.focus()
  }
})

again.addEventListener('click', event => {
  if (soundOn) unlockAudio()
  newRound(true)
  if (event.detail === 0) (hand.querySelector('button') ?? again).focus()
})

renderSetting('draw-limit', drawLimits, drawLimit, limit => `${limit} 回`, selected => {
  drawLimit = selected
  save('drawLimit', String(drawLimit))
})
renderSetting('tile-suit', tileSuits, tileSuit, suit => suit.label, selected => {
  tileSuit = selected
  save('tileSuit', tileSuit.id)
  for (const face of document.querySelectorAll<HTMLElement>('.tile[data-rank]')) {
    updateTileFace(face, face.querySelector('img')!, Number(face.dataset.rank))
  }
})

renderSetting('sound', [true, false], soundOn, enabled => enabled ? 'ON' : 'OFF', enabled => {
  soundOn = enabled
  save('sound', soundOn ? 'on' : 'off')
  if (soundOn) unlockAudio()
  else muteAudio()
})

openSettings.addEventListener('click', () => settings.showModal())
newRound(false)
