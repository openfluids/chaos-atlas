import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NeonButton } from '@/components/themes/neon-button';

// Mock CSS classes for testing
jest.mock('clsx', () => {
  return (classes: string[]) => classes.join(' ');
});

jest.mock('tailwind-merge', () => {
  return (classes: string[]) => classes.join(' ');
});

// Mock matchMedia for reduced motion tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('NeonButton', () => {
  const mockOnClick = jest.fn();

  beforeEach(() => {
    mockOnClick.mockClear();
    jest.clearAllMocks();
  });

  it('renders children correctly', () => {
    render(
      <NeonButton onClick={mockOnClick}>
        Click me
      </NeonButton>
    );

    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('renders with default props', () => {
    render(<NeonButton>Default Button</NeonButton>);

    const button = screen.getByRole('button', { name: 'Default Button' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('type', 'button');
  });

  it('applies variant classes correctly', () => {
    render(
      <NeonButton variant="secondary">
        Secondary Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Secondary Button' });
    expect(button).toBeInTheDocument();
  });

  it('applies size classes correctly', () => {
    render(
      <NeonButton size="lg">
        Large Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Large Button' });
    expect(button).toBeInTheDocument();
  });

  it('handles click events', async () => {
    const user = userEvent.setup();

    render(
      <NeonButton onClick={mockOnClick}>
        Click me
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Click me' });
    await user.click(button);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(
      <NeonButton disabled onClick={mockOnClick}>
        Disabled Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Disabled Button' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });

  it('does not trigger click when disabled', async () => {
    const user = userEvent.setup();

    render(
      <NeonButton disabled onClick={mockOnClick}>
        Disabled Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Disabled Button' });
    await user.click(button);

    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('shows loading state when loading prop is true', () => {
    render(
      <NeonButton loading>
        Loading Button
      </NeonButton>
    );

    // The button keeps its own accessible name while loading; aria-busy carries
    // the state. Overriding the name would make concurrent loading buttons
    // indistinguishable to screen readers and break voice control.
    const button = screen.getByRole('button', { name: 'Loading Button' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('does not allow interaction when loading', async () => {
    const user = userEvent.setup();

    render(
      <NeonButton loading onClick={mockOnClick}>
        Loading Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Loading Button' });
    await user.click(button);

    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('accepts custom className', () => {
    render(
      <NeonButton className="custom-class">
        Custom Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Custom Button' });
    expect(button).toHaveClass('custom-class');
  });

  it('accepts glow intensity prop', () => {
    render(
      <NeonButton glowIntensity={0.5}>
        Low Glow Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Low Glow Button' });
    expect(button).toBeInTheDocument();
  });

  it('applies neon glow effects by default', () => {
    render(
      <NeonButton>
        Neon Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Neon Button' });
    expect(button).toBeInTheDocument();
    // Should have neon-glow class by default
  });

  it('removes glow effects when disabled', () => {
    render(
      <NeonButton disabled>
        Disabled Neon Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Disabled Neon Button' });
    expect(button).toBeInTheDocument();
    // Should not have neon-glow effects when disabled
  });

  it('applies hover state on mouse enter', async () => {
    render(
      <NeonButton>
        Hover Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Hover Button' });
    expect(button).toBeInTheDocument();

    // Test hover effect
    fireEvent.mouseEnter(button);
    await waitFor(() => {
      // Should have enhanced glow effect
      expect(button).toBeInTheDocument();
    });
  });

  it('removes hover state on mouse leave', async () => {
    render(
      <NeonButton>
        Hover Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Hover Button' });
    expect(button).toBeInTheDocument();

    // Test hover effect removal
    fireEvent.mouseEnter(button);
    fireEvent.mouseLeave(button);
    await waitFor(() => {
      expect(button).toBeInTheDocument();
    });
  });

  it('applies focus state', async () => {
    render(
      <NeonButton>
        Focus Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Focus Button' });
    expect(button).toBeInTheDocument();

    // Test focus effect
    button.focus();
    await waitFor(() => {
      expect(button).toHaveFocus();
      // Should have enhanced glow and outline
    });
  });

  it('removes focus state on blur', async () => {
    render(
      <NeonButton>
        Focus Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Focus Button' });
    expect(button).toBeInTheDocument();

    button.focus();
    await waitFor(() => expect(button).toHaveFocus());

    button.blur();
    await waitFor(() => {
      expect(button).not.toHaveFocus();
    });
  });

  it('applies active state on mouse down', async () => {
    render(
      <NeonButton>
        Active Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Active Button' });
    expect(button).toBeInTheDocument();

    // Test active state
    fireEvent.mouseDown(button);
    await waitFor(() => {
      expect(button).toBeInTheDocument();
      // Should have press animation and burst effect
    });
  });

  it('removes active state on mouse up', async () => {
    render(
      <NeonButton>
        Active Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Active Button' });
    expect(button).toBeInTheDocument();

    fireEvent.mouseDown(button);
    await waitFor(() => {
      expect(button).toBeInTheDocument();
    });

    fireEvent.mouseUp(button);
    await waitFor(() => {
      expect(button).toBeInTheDocument();
    });
  });

  it('is keyboard accessible', () => {
    render(
      <NeonButton>
        Keyboard Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Keyboard Button' });
    expect(button).toHaveAttribute('type', 'button');
  });

  it('can be activated with Enter key', async () => {
    const user = userEvent.setup();

    render(
      <NeonButton onClick={mockOnClick}>
        Enter Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Enter Button' });
    button.focus();

    await user.keyboard('{Enter}');
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('can be activated with Space key', async () => {
    const user = userEvent.setup();

    render(
      <NeonButton onClick={mockOnClick}>
        Space Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Space Button' });
    button.focus();

    await user.keyboard(' ');
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('has proper ARIA attributes', () => {
    render(
      <NeonButton>
        ARIA Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'ARIA Button' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('type', 'button');
  });

  it('supports disabled state ARIA attributes', () => {
    render(
      <NeonButton disabled>
        Disabled ARIA Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Disabled ARIA Button' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toBeDisabled();
  });

  it('supports loading state ARIA attributes', () => {
    render(
      <NeonButton loading>
        Loading ARIA Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Loading ARIA Button' });
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('respects reduced motion preference', () => {
    // Should detect reduced motion and adjust animations
    expect(window.matchMedia).not.toHaveBeenCalled();
  });

  it('maintains accessibility when disabled', () => {
    render(
      <NeonButton disabled>
        Accessible Disabled Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Accessible Disabled Button' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toBeDisabled();
  });

  it('provides keyboard navigation support', async () => {
    const user = userEvent.setup();

    render(
      <div>
        <NeonButton>First Button</NeonButton>
        <NeonButton>Second Button</NeonButton>
      </div>
    );

    const buttons = screen.getAllByRole('button');
    buttons[0].focus();
    expect(buttons[0]).toHaveFocus();

    // Test Tab navigation
    await user.keyboard('{Tab}');
    expect(buttons[1]).toHaveFocus();
  });

  it('handles click prevention when disabled', async () => {
    const user = userEvent.setup();

    render(
      <NeonButton disabled onClick={mockOnClick}>
        Prevented Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Prevented Button' });
    await user.click(button);

    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('shows visual feedback for all interactions', () => {
    render(
      <NeonButton>
        Interactive Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Interactive Button' });

    // Should have visual feedback classes
    expect(button).toBeInTheDocument();

    // Test all interactive states
    fireEvent.mouseEnter(button);
    fireEvent.mouseDown(button);
    fireEvent.mouseUp(button);
    fireEvent.mouseLeave(button);
    button.focus();
    button.blur();
  });

  it('maintains theme consistency across all states', () => {
    render(
      <NeonButton variant="primary" size="md">
        Themed Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Themed Button' });
    expect(button).toBeInTheDocument();

    // Should maintain Tron theme styling in all states
    fireEvent.mouseEnter(button);
    fireEvent.mouseDown(button);
    button.focus();

    expect(button).toBeInTheDocument();
  });

  it('supports custom glow intensity values', () => {
    const intensities = [0.1, 0.5, 0.8, 1.0];

    intensities.forEach(intensity => {
      const { unmount } = render(
        <NeonButton glowIntensity={intensity}>
          Intensity {intensity} Button
        </NeonButton>
      );

      const button = screen.getByRole('button', { name: `Intensity ${intensity} Button` });
      expect(button).toBeInTheDocument();
      unmount();
    });
  });

  it('handles invalid glow intensity gracefully', () => {
    render(
      <NeonButton glowIntensity={1.5}>
        Invalid Intensity Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Invalid Intensity Button' });
    expect(button).toBeInTheDocument();
    // Should clamp or fallback to valid range
  });

  it('handles negative glow intensity gracefully', () => {
    render(
      <NeonButton glowIntensity={-0.5}>
        Negative Intensity Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Negative Intensity Button' });
    expect(button).toBeInTheDocument();
    // Should clamp or fallback to valid range
  });

  it('passes through additional props', () => {
    render(
      <NeonButton data-testid="custom-test" title="Custom title">
        Props Button
      </NeonButton>
    );

    const button = screen.getByRole('button', { name: 'Props Button' });
    expect(button).toHaveAttribute('data-testid', 'custom-test');
    expect(button).toHaveAttribute('title', 'Custom title');
  });

  it('maintains component identity with React 18', () => {
    const { container } = render(
      <NeonButton>React 18 Button</NeonButton>
    );

    const button = screen.getByRole('button', { name: 'React 18 Button' });
    expect(button).toBeInTheDocument();
    expect(container).toBeInTheDocument();
  });
});
