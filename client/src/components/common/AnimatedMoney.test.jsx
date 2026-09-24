import { render, screen } from '@testing-library/react';
import { MotionConfig } from 'motion/react';
import { describe, expect, it } from 'vitest';
import { mockMatchMedia } from '@/test/utils';
import { AnimatedMoney } from './AnimatedMoney';

describe('AnimatedMoney', () => {
  it('shows the final amount straight away when motion is reduced', () => {
    render(<AnimatedMoney paise={10000000} />);
    // Visible copy and screen-reader copy are both final.
    expect(screen.getAllByText('₹1,00,000')).toHaveLength(2);
  });

  it('always gives screen readers the final amount, even while counting', () => {
    mockMatchMedia(false);
    // Make this test's reduce-motion answer "no", so the count-up really runs.
    window.matchMedia = ((original) => (query) => ({
      ...original(query),
      matches: query.includes('reduced-motion') ? false : original(query).matches,
    }))(window.matchMedia);

    render(
      <MotionConfig reducedMotion="never">
        <AnimatedMoney paise={25050} />
      </MotionConfig>,
    );

    const final = screen.getByText('₹250.50', { selector: '.sr-only' });
    expect(final).toBeInTheDocument();
    // The moving copy is hidden from assistive tech.
    expect(final.previousSibling).toHaveAttribute('aria-hidden', 'true');
  });
});
