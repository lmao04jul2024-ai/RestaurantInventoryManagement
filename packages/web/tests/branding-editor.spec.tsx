import { render, screen, fireEvent } from '@testing-library/react';
import BrandingEditor from '@/components/dashboard/branding-editor';
import { FONT_OPTIONS } from '@/lib/theme';

const onChange = jest.fn();

const renderEditor = (theme: Record<string, unknown> = {}) =>
  render(
    <BrandingEditor
      draft={{ preset: 'classic', mode: 'light', ...theme } as never}
      onChange={onChange}
    />,
  );

describe('BrandingEditor — Week 17.5 logo & typography drafting', () => {
  beforeEach(() => onChange.mockClear());

  it('lists the full web-safe font catalog with the current brand font selected', () => {
    renderEditor({ branding: { fontFamily: 'trebuchet' } });

    const select = screen.getByLabelText('Brand font') as HTMLSelectElement;
    expect(select.value).toBe('trebuchet');
    expect(Object.keys(FONT_OPTIONS)).toHaveLength(4);
    for (const id of Object.keys(FONT_OPTIONS)) {
      expect(screen.getByRole('option', { name: FONT_OPTIONS[id as keyof typeof FONT_OPTIONS].label })).toBeInTheDocument();
    }
  });

  it('drafts a new font into branding without publishing', () => {
    renderEditor({ branding: { logoUrl: 'https://cdn.test/logo.png' } });

    fireEvent.change(screen.getByLabelText('Brand font'), { target: { value: 'georgia' } });

    expect(onChange).toHaveBeenCalledWith({ branding: { logoUrl: 'https://cdn.test/logo.png', fontFamily: 'georgia' } });
  });

  it('shows the logo preview chip once a logo URL is drafted', () => {
    const { rerender } = renderEditor();

    // No branding → no preview chip.
    expect(screen.queryByAltText('Logo preview')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Logo URL'), {
      target: { value: 'https://cdn.test/logo.png' },
    });
    expect(onChange).toHaveBeenCalledWith({ branding: { logoUrl: 'https://cdn.test/logo.png' } });

    rerender(
      <BrandingEditor
        draft={{ preset: 'classic', mode: 'light', branding: { logoUrl: 'https://cdn.test/logo.png' } } as never}
        onChange={onChange}
      />,
    );
    expect(screen.getByAltText('Logo preview')).toHaveAttribute('src', 'https://cdn.test/logo.png');
  });

  it('clears branding back to null when the logo field is emptied', () => {
    renderEditor({ branding: { logoUrl: 'https://cdn.test/logo.png', fontFamily: 'mono' } });

    fireEvent.change(screen.getByLabelText('Logo URL'), { target: { value: '   ' } });

    expect(onChange).toHaveBeenCalledWith({ branding: { logoUrl: null, fontFamily: 'mono' } });
  });
});