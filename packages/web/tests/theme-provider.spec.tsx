import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ThemeProvider from '@/components/theme/theme-provider';
import ThemeSwitcher from '@/components/theme/theme-switcher';
import { loadThemePrefs } from '@/lib/theme';

function varOf(name: string): string {
  return document.documentElement.style.getPropertyValue(name);
}

describe('ThemeProvider + ThemeSwitcher — Week 13 switching mechanism', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.cssText = '';
  });

  it('applies classic defaults inline on mount and stamps data-theme', async () => {
    render(
      <ThemeProvider>
        <ThemeSwitcher />
      </ThemeProvider>,
    );
    await waitFor(() => expect(varOf('--color-primary-600')).toBe('234 88 12'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('switching preset regenerates every primary/secondary variable and persists', async () => {
    render(
      <ThemeProvider>
        <ThemeSwitcher />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole('radio', { name: /emerald/i }));

    await waitFor(() => expect(varOf('--color-primary-600')).toBe('5 150 105'));
    expect(varOf('--color-secondary-600')).toBe('217 119 6');
    expect(loadThemePrefs()?.preset).toBe('emerald');
  });

  it('custom color pickers regenerate the palette from the chosen hex', async () => {
    render(
      <ThemeProvider>
        <ThemeSwitcher />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole('radio', { name: /custom/i }));

    const input = screen.getByLabelText(/primary/i) as HTMLInputElement;
    await waitFor(() => expect(varOf('--color-primary-600')).toBe('234 88 12')); // default custom anchor
    fireEvent.change(input, { target: { value: '#123456' } });

    await waitFor(() => expect(varOf('--color-primary-600')).toBe('18 52 86'));
  });

  it('Dark mode flips surfaces via data-theme and inline vars', async () => {
    render(
      <ThemeProvider>
        <ThemeSwitcher />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));

    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('dark'));
    expect(varOf('--color-surface')).toBe('28 25 23');
    expect(varOf('--color-content-default')).toBe('250 250 249');
  });
});

