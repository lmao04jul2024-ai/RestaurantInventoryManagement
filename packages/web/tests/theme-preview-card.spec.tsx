import { render, screen } from '@testing-library/react';
import ThemePreviewCard from '@/components/dashboard/theme-preview-card';

describe('ThemePreviewCard — Week 17.6 scoped live preview', () => {
  it('renders the mini-storefront with draft palette vars scoped to the container', () => {
    render(<ThemePreviewCard draft={{ preset: 'classic', mode: 'light' }} restaurantName="Casa Mia" />);

    expect(screen.getByLabelText('Storefront preview')).toBeInTheDocument();
    expect(screen.getByText('Casa Mia')).toBeInTheDocument();
    expect(screen.getByText('Margherita Pizza')).toBeInTheDocument();

    const scope = screen.getByTestId('preview-scope') as HTMLElement;
    expect(scope.style.getPropertyValue('--color-primary-600')).toBe('234 88 12');
    // Draft-only font default: no brand font var emitted.
    expect(scope.style.getPropertyValue('--font-family-sans')).toBe('');
  });

  it('applies custom hex anchors and dark surfaces without touching :root', () => {
    render(
      <ThemePreviewCard
        draft={{ preset: 'custom', mode: 'dark', custom: { primary: '#123456', secondary: '#abcdef' } }}
        restaurantName="Casa Mia"
      />,
    );

    const scope = screen.getByTestId('preview-scope') as HTMLElement;
    expect(scope.style.getPropertyValue('--color-primary-600')).toBe('18 52 86');
    expect(scope.style.getPropertyValue('--color-secondary-600')).toBe('171 205 239');
    expect(scope.style.getPropertyValue('--color-surface')).toBe('28 25 23');
    expect(screen.getByText('Dark surfaces')).toBeInTheDocument();

    // Isolation: drafting must never leak palette vars into :root.
    expect(document.documentElement.style.getPropertyValue('--color-primary-600')).toBe('');
  });

  it('shows the font label and emits the brand font var when a font is set', () => {
    render(
      <ThemePreviewCard
        draft={{ preset: 'emerald', mode: 'light', branding: { fontFamily: 'georgia' } }}
        restaurantName="Casa Mia"
      />,
    );

    expect(screen.getByText(/Georgia \(classic serif\)/)).toBeInTheDocument();
    const scope = screen.getByTestId('preview-scope') as HTMLElement;
    expect(scope.style.getPropertyValue('--font-family-sans')).toContain('Georgia');
  });

  it('shows a logo image when branding.logoUrl is set and the emoji fallback otherwise', () => {
    const { rerender } = render(
      <ThemePreviewCard draft={{ preset: 'classic', mode: 'light' }} restaurantName="Casa Mia" />,
    );
    expect(screen.getByText('🍽️')).toBeInTheDocument();

    rerender(
      <ThemePreviewCard
        draft={{ preset: 'classic', mode: 'light', branding: { logoUrl: 'https://cdn.test/logo.png' } }}
        restaurantName="Casa Mia"
      />,
    );

    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://cdn.test/logo.png');
    expect(screen.queryByText('🍽️')).not.toBeInTheDocument();
  });

  it('falls back to the default prefs for an invalid draft (custom preset without hexes)', () => {
    render(<ThemePreviewCard draft={{ preset: 'custom', mode: 'light' }} restaurantName="Casa Mia" />);

    // Invalid custom doc → DEFAULT_THEME_PREFS (classic/system) drives the vars,
    // so the 600 anchor lands back on the classic amber.
    const scope = screen.getByTestId('preview-scope') as HTMLElement;
    expect(scope.style.getPropertyValue('--color-primary-600')).toBe('234 88 12');
    expect(scope.style.getPropertyValue('--color-secondary-600')).toBe('13 148 136');
  });
});