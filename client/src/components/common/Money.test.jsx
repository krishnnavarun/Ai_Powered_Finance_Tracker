import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Money } from './Money';

describe('Money', () => {
  it('formats paise with Indian grouping', () => {
    render(<Money paise={10000000} />);
    expect(screen.getByText('₹1,00,000')).toBeInTheDocument();
  });

  it('shows a + sign and income colour for income', () => {
    render(<Money paise={25050} tone="income" />);
    const el = screen.getByText('+₹250.50');
    expect(el).toHaveClass('text-income');
  });

  it('shows a − sign for expenses even if the amount is negative', () => {
    render(<Money paise={-15000} tone="expense" />);
    expect(screen.getByText('−₹150')).toHaveClass('text-expense');
  });
});
