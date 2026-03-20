/**
 * TaskForm Component Tests
 *
 * TDD: Written FIRST (RED), implementation follows (GREEN).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskForm } from './TaskForm';

// =============================================================================
// Helpers
// =============================================================================

const mockSubmit = vi.fn();

function renderForm(overrides = {}) {
  return render(<TaskForm onSubmit={mockSubmit} {...overrides} />);
}

beforeEach(() => {
  mockSubmit.mockReset();
});

// =============================================================================
// Tests
// =============================================================================

describe('TaskForm', () => {
  describe('rendering', () => {
    it('renders prompt textarea', () => {
      renderForm();
      expect(screen.getByRole('textbox', { name: /prompt/i })).toBeInTheDocument();
    });

    it('renders budget input', () => {
      renderForm();
      expect(screen.getByRole('spinbutton', { name: /budget/i })).toBeInTheDocument();
    });

    it('renders deadline input', () => {
      renderForm();
      expect(screen.getByRole('spinbutton', { name: /deadline/i })).toBeInTheDocument();
    });

    it('renders source checkboxes for all providers', () => {
      renderForm();
      expect(screen.getByRole('checkbox', { name: /exa/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /perplexity/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /cern/i })).toBeInTheDocument();
    });

    it('renders submit button', () => {
      renderForm();
      expect(screen.getByRole('button', { name: /start research/i })).toBeInTheDocument();
    });

    it('renders cover image enhancement toggle', () => {
      renderForm();
      expect(screen.getByRole('checkbox', { name: /cover image/i })).toBeInTheDocument();
    });

    it('exa is checked by default', () => {
      renderForm();
      expect(screen.getByRole('checkbox', { name: /exa/i })).toBeChecked();
    });
  });

  describe('validation', () => {
    it('disables submit when prompt is empty', () => {
      renderForm();
      expect(screen.getByRole('button', { name: /start research/i })).toBeDisabled();
    });

    it('enables submit when prompt and budget are filled', async () => {
      const user = userEvent.setup();
      renderForm();
      await user.type(screen.getByRole('textbox', { name: /prompt/i }), 'Find CERN dossier on Hououin Kyouma');
      await user.clear(screen.getByRole('spinbutton', { name: /budget/i }));
      await user.type(screen.getByRole('spinbutton', { name: /budget/i }), '1');
      expect(screen.getByRole('button', { name: /start research/i })).not.toBeDisabled();
    });

    it('requires at least one source selected', async () => {
      const user = userEvent.setup();
      renderForm();
      await user.type(screen.getByRole('textbox', { name: /prompt/i }), 'test prompt');
      // Uncheck exa (only default)
      await user.click(screen.getByRole('checkbox', { name: /exa/i }));
      expect(screen.getByRole('button', { name: /start research/i })).toBeDisabled();
    });
  });

  describe('submission', () => {
    it('calls onSubmit with correct payload', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByRole('textbox', { name: /prompt/i }), 'Find CERN dossier on Hououin Kyouma');
      await user.clear(screen.getByRole('spinbutton', { name: /budget/i }));
      await user.type(screen.getByRole('spinbutton', { name: /budget/i }), '1');
      await user.click(screen.getByRole('button', { name: /start research/i }));

      expect(mockSubmit).toHaveBeenCalledOnce();
      const payload = mockSubmit.mock.calls[0][0];
      expect(payload.prompt).toBe('Find CERN dossier on Hououin Kyouma');
      expect(payload.sources).toContain('exa');
      expect(typeof payload.budgetEth).toBe('number');
      expect(payload.budgetEth).toBe(1);
      expect(payload.enhancements.coverImage).toBe(false);
    });

    it('includes selected sources in payload', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByRole('textbox', { name: /prompt/i }), 'test');
      await user.clear(screen.getByRole('spinbutton', { name: /budget/i }));
      await user.type(screen.getByRole('spinbutton', { name: /budget/i }), '1');
      await user.click(screen.getByRole('checkbox', { name: /perplexity/i }));
      await user.click(screen.getByRole('button', { name: /start research/i }));

      const payload = mockSubmit.mock.calls[0][0];
      expect(payload.sources).toContain('exa');
      expect(payload.sources).toContain('perplexity');
    });

    it('includes the selected cover-image enhancement in the payload', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByRole('textbox', { name: /prompt/i }), 'test');
      await user.clear(screen.getByRole('spinbutton', { name: /budget/i }));
      await user.type(screen.getByRole('spinbutton', { name: /budget/i }), '1');
      await user.click(screen.getByRole('checkbox', { name: /cover image/i }));
      await user.click(screen.getByRole('button', { name: /start research/i }));

      const payload = mockSubmit.mock.calls[0][0];
      expect(payload.enhancements.coverImage).toBe(true);
    });

    it('shows loading state after submit', async () => {
      const user = userEvent.setup();
      const slowSubmit = vi.fn(() => new Promise(r => setTimeout(r, 1000)));
      renderForm({ onSubmit: slowSubmit });

      await user.type(screen.getByRole('textbox', { name: /prompt/i }), 'test');
      await user.clear(screen.getByRole('spinbutton', { name: /budget/i }));
      await user.type(screen.getByRole('spinbutton', { name: /budget/i }), '1');
      await user.click(screen.getByRole('button', { name: /start research/i }));

      expect(screen.getByRole('button', { name: /starting/i })).toBeDisabled();
    });
  });
});
