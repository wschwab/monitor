import { describe, expect, it } from 'vitest';
import { generateCoverImage } from './cover-image';

describe('generateCoverImage', () => {
  it('returns the canonical demo artwork for the Hououin Kyouma prompt', () => {
    const image = generateCoverImage({
      prompt: 'Find the classified CERN dossier on Hououin Kyouma and summarize his temporal interference incidents',
      taskId: 'task-kyouma',
      report: '# Report',
    });

    expect(image.title).toMatch(/Hououin Kyouma/i);
    expect(image.imageUrl).toContain('hououin-kyouma');
    expect(image.alt).toContain('temporal');
  });

  it('falls back to a deterministic generic cover image for unknown prompts', () => {
    const image = generateCoverImage({
      prompt: 'Research the current state of restaking protocols',
      taskId: 'task-restaking',
      report: '# Report',
    });

    expect(image.title).toMatch(/Research Brief/i);
    expect(image.imageUrl).toContain('generic');
  });
});
