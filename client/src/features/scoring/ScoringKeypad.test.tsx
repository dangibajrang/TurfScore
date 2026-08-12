/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScoringKeypad } from './components/ScoringKeypad';

describe('ScoringKeypad', () => {
  it('renders run buttons and does not invent scores', () => {
    const onRuns = vi.fn();
    render(
      <ScoringKeypad
        onRuns={onRuns}
        onWicket={vi.fn()}
        onWide={vi.fn()}
        onNoBall={vi.fn()}
        onBye={vi.fn()}
        onLegBye={vi.fn()}
        onUndo={vi.fn()}
      />,
    );
    expect(screen.getByTestId('scoring-keypad')).toBeTruthy();
    expect(screen.getByTestId('score-4')).toBeTruthy();
    expect(screen.getByTestId('score-wicket')).toBeTruthy();
    screen.getByTestId('score-1').click();
    expect(onRuns).toHaveBeenCalledWith(1);
  });
});
