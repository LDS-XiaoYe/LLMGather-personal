import { reciprocalRankFusion } from './rrf';
describe('RRF', () => {
  it('ignores incompatible raw scores and deduplicates within each provider', () => {
    const result = reciprocalRankFusion(
      [
        [
          { id: 'a', score: 10000 },
          { id: 'b', score: 9999 },
          { id: 'b', score: 9998 },
        ],
        [
          { id: 'b', score: 0.01 },
          { id: 'c', score: 0.001 },
        ],
      ],
      3,
    );
    expect(result.map((r) => r.id)).toEqual(['b', 'a', 'c']);
    expect(result[0].score).toBeCloseTo(1 / 62 + 1 / 61);
  });
  it('does not collapse different KBs with the same external ID', () => {
    expect(
      reciprocalRankFusion([[{ id: 'a', kb: 'x' }], [{ id: 'a', kb: 'y' }]], 10, (r) => r.kb + ':' + r.id),
    ).toHaveLength(2);
  });
});
