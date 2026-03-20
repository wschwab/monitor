import {
  buildGenericCoverImageFixture,
  getDemoPromptFixture,
} from '../demo/prompt-fixtures';

export interface CoverImageRequest {
  prompt: string;
  report: string;
  taskId: string;
}

export interface CoverImageResult {
  imageUrl: string;
  title: string;
  alt: string;
  prompt: string;
  generatedAt: string;
}

export function generateCoverImage(request: CoverImageRequest): CoverImageResult {
  const fixture =
    getDemoPromptFixture(request.prompt)?.coverImage ??
    buildGenericCoverImageFixture(request.prompt);

  return {
    ...fixture,
    generatedAt: new Date().toISOString(),
  };
}
