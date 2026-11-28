import test from 'node:test'
import assert from 'node:assert/strict'
import { completedGroups, discard, drawLimits, findWin, held, makeWall, startRound } from '../src/game.ts'

const tiles = ranks => ranks.map((rank, id) => ({ id, rank }))

test('wall contains four copies of each rank with distinct identities and is shuffled', () => {
  const wall = makeWall(() => 0)
  assert.equal(wall.length, 36)
  assert.equal(new Set(wall.map(tile => tile.id)).size, 36)
  for (let rank = 1; rank <= 9; rank++) {
    assert.equal(wall.filter(tile => tile.rank === rank).length, 4)
  }
  assert.deepEqual(wall.map(tile => tile.id), [...Array.from({ length: 35 }, (_, i) => i + 1), 0])
  assert.equal(startRound(wall).wall.length, 31)
})

test('deals four sorted tiles and draws the next tile, then moves only the selected copy', () => {
  const wall = tiles([9, 4, 2, 4, 1, 8])
  const initial = startRound(wall)
  assert.deepEqual(initial.hand.map(tile => tile.id), [2, 1, 3, 0])
  assert.equal(initial.drawn, wall[4])
  assert.equal(discard(initial, 40), initial)
  const next = discard(initial, wall[3].id)
  assert.deepEqual(next.discards, [wall[3]])
  assert.deepEqual(next.hand.map(tile => tile.id), [4, 2, 1, 0])
  assert.equal(next.drawn, wall[5])
  assert.equal(wall.length, 6)
})

test('detects sequences and triplets, trying other pairs when the first candidate fails', () => {
  const sequence = findWin(tiles([4, 2, 4, 2, 2]))
  assert.deepEqual(sequence.pair.tiles.map(tile => tile.rank), [4, 4])
  assert.deepEqual(sequence.meld.tiles.map(tile => tile.rank), [2, 2, 2])
  assert.ok(findWin(tiles([9, 1, 9, 1, 9])))
  assert.ok(findWin(tiles([4, 2, 4, 1, 3])))
  assert.equal(findWin(tiles([1, 1, 2, 4, 5])), undefined)
  assert.equal(findWin(tiles([1, 1, 2, 3])), undefined)
  assert.equal(startRound(tiles([3, 2, 9, 9, 1])).phase, 'won')
})

test('a win on the last draw takes priority and ends the round', () => {
  const round = startRound(tiles([1, 2, 9, 9, 5, 3]))
  const won = discard(round, round.drawn.id)
  assert.equal(won.phase, 'won')
  assert.equal(won.wall.length, 0)
  assert.equal(discard(won, won.drawn.id), won)
})

test('the last nonwinning draw stays actionable and the next discard ends the round', () => {
  const round = startRound(tiles([1, 2, 5, 7, 9]))
  assert.equal(round.phase, 'playing')
  assert.equal(round.wall.length, 0)
  const ended = discard(round, round.drawn.id)
  assert.equal(ended.phase, 'draw')
  assert.equal(held(ended).length, 4)
  assert.deepEqual(ended.discards, [round.drawn])
  assert.equal(discard(ended, ended.hand[0].id), ended)
})

test('the default is ten draws and each selectable limit counts the automatic first draw', () => {
  const wall = makeWall(() => 0.5)
  assert.deepEqual(drawLimits, [5, 10, 15, 20, 32])
  assert.equal(startRound(wall).remainingDraws, 9)
  const nonwinningWall = tiles([1, 2, 5, 7, ...wall.slice(4).map(tile => tile.rank)])
  for (const limit of drawLimits) {
    let round = startRound(nonwinningWall, limit)
    for (let drawn = 1; drawn <= limit; drawn++) {
      assert.equal(round.phase, 'playing')
      assert.equal(round.remainingDraws, limit - drawn)
      assert.equal(round.drawn, nonwinningWall[3 + drawn])
      round = discard(round, round.drawn.id)
    }
    assert.equal(round.phase, 'draw')
    assert.deepEqual(round.wall, nonwinningWall.slice(4 + limit))
    assert.deepEqual(round.discards, nonwinningWall.slice(4, 4 + limit))
    assert.equal(held(round).length, 4)
  }
})

test('a win on the configured final draw takes priority with tiles still in the wall', () => {
  const wall = tiles([1, 2, 9, 9, 5, 6, 7, 8, 3, 4])
  let round = startRound(wall, 5)
  for (let i = 0; i < 4; i++) round = discard(round, round.drawn.id)
  assert.equal(round.phase, 'won')
  assert.equal(round.remainingDraws, 0)
  assert.deepEqual(round.wall, [wall[9]])
})

test('recognizes overlapping groups and keeps their keys stable across equivalent copies', () => {
  const first = completedGroups(tiles([1, 2, 3, 3, 4]))
  assert.deepEqual([...first.keys()].sort(), ['meld:1,2,3', 'meld:2,3,4', 'pair:3,3'])
  const replaced = tiles([1, 2, 3, 3, 4]).map(tile => ({ ...tile, id: tile.id + 10 }))
  assert.deepEqual([...completedGroups(replaced).keys()], [...first.keys()])
})
