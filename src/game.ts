export type Tile = { id: number; rank: number }
export type Group = { kind: 'pair' | 'meld'; tiles: Tile[] }
export type Win = { pair: Group; meld: Group }
export type Round = {
  wall: Tile[]
  hand: Tile[]
  drawn: Tile | undefined
  discards: Tile[]
  win: Win | undefined
  phase: 'playing' | 'won' | 'draw'
}

export function makeWall(random = Math.random): Tile[] {
  const wall = Array.from({ length: 36 }, (_, id) => ({ id, rank: Math.floor(id / 4) + 1 }))
  for (let i = wall.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const tile = wall[i]
    wall[i] = wall[j]
    wall[j] = tile
  }
  return wall
}

function sorted(tiles: Tile[]) {
  return [...tiles].sort((a, b) => a.rank - b.rank || a.id - b.id)
}

export function held(round: Round) {
  return round.drawn ? [...round.hand, round.drawn] : round.hand
}

function isMeld([a, b, c]: Tile[]) {
  return a.rank === c.rank || (a.rank + 1 === b.rank && b.rank + 1 === c.rank)
}

export function findWin(tiles: Tile[]): Win | undefined {
  if (tiles.length !== 5) return
  const ordered = sorted(tiles)
  for (let i = 0; i < ordered.length - 1; i++) {
    if (ordered[i].rank !== ordered[i + 1].rank) continue
    const rest = ordered.filter((_, index) => index !== i && index !== i + 1)
    if (isMeld(rest)) {
      return {
        pair: { kind: 'pair', tiles: ordered.slice(i, i + 2) },
        meld: { kind: 'meld', tiles: rest },
      }
    }
  }
}

export function completedGroups(tiles: Tile[]): Map<string, Group> {
  const groups = new Map<string, Group>()
  const ordered = sorted(tiles)
  function add(kind: Group['kind'], members: Tile[]) {
    const key = kind + ':' + members.map(tile => tile.rank).join(',')
    groups.set(key, { kind, tiles: members })
  }
  for (let i = 0; i < ordered.length; i++) {
    const a = ordered[i]
    for (let j = i + 1; j < ordered.length; j++) {
      const b = ordered[j]
      if (a.rank === b.rank) add('pair', [a, b])
      for (let k = j + 1; k < ordered.length; k++) {
        const c = ordered[k]
        if (isMeld([a, b, c])) add('meld', [a, b, c])
      }
    }
  }
  return groups
}

function draw(hand: Tile[], wall: Tile[], discards: Tile[]): Round {
  const [drawn, ...remaining] = wall
  const win = drawn ? findWin([...hand, drawn]) : undefined
  return { hand, drawn, wall: remaining, discards, win,
    phase: win ? 'won' : drawn ? 'playing' : 'draw' }
}

export function startRound(wall = makeWall()) {
  return draw(sorted(wall.slice(0, 4)), wall.slice(4), [])
}

export function discard(round: Round, id: number): Round {
  if (round.phase !== 'playing') return round
  const tiles = held(round)
  const tile = tiles.find(item => item.id === id)
  if (!tile) return round
  return draw(sorted(tiles.filter(item => item.id !== id)), round.wall, [...round.discards, tile])
}
