import { fireEvent, render, screen } from '@testing-library/react';
import Button from '@/components/ui/button';

describe('Button', () => {
  it('renders children with the default primary styling', () => {
    render(<Button>Save order</Button>);

    const btn = screen.getByRole('button', { name: 'Save order' });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain('bg-primary-600');
  });

  it('applies requested variant classes', () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole('button').className).toContain('bg-red-600');
  });

  it('merges consumer className without clobbering base styles', () => {
    render(<Button className="w-full">Full</Button>);
    const cls = screen.getByRole('button').className;
    expect(cls).toContain('w-full');
    expect(cls).toContain('inline-flex');
  });

  it('shows a spinner and disables interaction while loading', () => {
    const onClick = jest.fn();
    render(
      <Button isLoading onClick={onClick}>
        Submit
      </Button>,
    );

    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn.querySelector('.animate-spin')).toBeInTheDocument();

    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('invokes onClick for enabled buttons', () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Tap</Button>);

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
