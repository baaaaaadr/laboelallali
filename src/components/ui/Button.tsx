import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { Loader2 } from 'lucide-react';
import { VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Simplified button variants using plain objects
const variantClasses = {
  primary: 'bg-fuchsia hover:bg-fuchsia-bright text-white shadow-fuchsia hover:shadow-md',
  secondary: 'bg-bordeaux hover:bg-bordeaux-dark text-white shadow-bordeaux hover:shadow-md',
  outline: 'bg-transparent border-2 border-bordeaux text-bordeaux hover:bg-bordeaux-pale',
  text: 'bg-transparent text-bordeaux hover:bg-bordeaux-pale',
  whatsapp: 'bg-[#25D366] hover:bg-[#128C7E] text-white shadow-md hover:shadow-lg',
} as const;

const sizeClasses = {
  sm: 'text-sm py-1.5 px-3',
  md: 'text-base py-2 px-4',
  lg: 'text-lg py-3 px-6',
} as const;

const baseClasses = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-fuchsia disabled:opacity-70 disabled:pointer-events-none';

// Helper function to get button classes
const getButtonClasses = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) => {
  return cn(
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    className
  );
};

// Simplified Button props to avoid deep type instantiation
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'text' | 'whatsapp';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  href?: string;
  target?: string;
  rel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className,
    variant = 'primary',
    size = 'md',
    asChild = false,
    isLoading = false,
    leftIcon,
    rightIcon,
    children, // User-provided children
    fullWidth,
    disabled,
    type,
    ...otherProps
  },
  ref
) => {
  const isDisabled = disabled || isLoading;

  const buttonStyleClasses = cn(
    baseClasses,             // Base styles first (includes default disabled: styling)
    variantClasses[variant], // Variant specific styles
    sizeClasses[size],       // Size specific styles
    {
      'w-full': fullWidth,   // Conditional full width
      // Explicitly add visual disabled styles. This is crucial for `asChild`
      // where the child element might not have a `disabled` attribute, so
      // Tailwind's `disabled:` prefix from baseClasses might not activate.
      // For regular buttons, these styles might be redundant with `disabled:` but are harmless.
      'opacity-70': isDisabled,
      'cursor-not-allowed': isDisabled,
    },
    className                // User's custom classes for overrides/additions
  );

  if (asChild) {
    // When asChild is true, Slot renders its child with the merged props.
    // The `disabled` attribute itself is not explicitly passed to Slot here
    // to avoid TypeScript errors, as SlotProps doesn't define it.
    // The visual disabled state is handled by the `buttonStyleClasses`.
    // The child component is responsible for its own behavior if it receives these classes.
    return (
      <Slot
        ref={ref}
        className={buttonStyleClasses}
        {...otherProps}       // Pass all other props (href, onClick, aria-attributes, etc.)
      >
        {children} 
      </Slot>
    );
  }

  // Default: render a <button> element
  const buttonElementContent = (
    <>
      {isLoading ? (
        <Loader2 className="animate-spin mr-2 h-4 w-4" />
      ) : leftIcon ? (
        <span className="mr-2">{leftIcon}</span>
      ) : null}
      {children} {/* User's main content for the button */}
      {rightIcon && !isLoading && (
        <span className="ml-2">{rightIcon}</span>
      )}
    </>
  );

  return (
    <button
      ref={ref}
      type={type || 'button'} // Default to 'button' if not provided
      className={buttonStyleClasses}
      disabled={isDisabled}     // The `disabled` attribute here activates Tailwind's `disabled:` variants in baseClasses
      {...otherProps}
    >
      {buttonElementContent}
    </button>
  );
}
);

Button.displayName = 'Button';

// Export button variants and sizes for external use
export const buttonVariants = Object.keys(variantClasses);
export const buttonSizes = Object.keys(sizeClasses);

export { Button };
export type { ButtonVariant, ButtonSize };
