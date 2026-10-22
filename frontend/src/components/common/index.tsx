import * as React from 'react';
import { forwardRef, useState, useRef, ReactElement } from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, disabled, loading, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={clsx(
        variant ? `btn-${variant}` : 'btn',
        size === 'sm' && 'px-2 py-1 text-xs',
        size === 'lg' && 'px-6 py-3 text-base',
        loading && 'opacity-75 cursor-wait',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  )
);

Button.displayName = 'Button';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={clsx('input', className)}
      {...props}
    />
  )
);

Input.displayName = 'Input';

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={clsx('select', className)}
      {...props}
    />
  )
);

Select.displayName = 'Select';

export const Badge = ({ children, className, variant = 'neutral' }: { children: React.ReactNode; className?: string; variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }) => (
  <span className={clsx('badge', `badge-${variant}`, className)}>
    {children}
  </span>
);

export const Card = ({ children, className, ...props }: { children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx('card', className)} {...props}>
    {children}
  </div>
);

export const CardHeader = ({ children, className, ...props }: { children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx('card-header', className)} {...props}>
    {children}
  </div>
);

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className={clsx('modal-content', sizeClasses[size])} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="modal-title" className="text-lg font-semibold text-dark-100">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 text-dark-400 hover:text-dark-100 rounded-lg hover:bg-dark-800 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
};

export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
}) => (
  <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
    <div className="modal-body">
      <p className="text-dark-300">{message}</p>
    </div>
    <div className="modal-footer">
      <button onClick={onClose} className="btn-secondary" disabled={loading}>
        {cancelText}
      </button>
      <button
        onClick={onConfirm}
        className={`btn-${variant}`}
        disabled={loading}
      >
        {loading ? 'Processing...' : confirmText}
      </button>
    </div>
  </Modal>
);

export const Table = ({ children, className, ...props }: { children: React.ReactNode; className?: string } & React.TableHTMLAttributes<HTMLTableElement>) => (
  <div className={clsx('table-container', className)}>
    <table className={clsx('table', className)} {...props}>
      {children}
    </table>
  </div>
);

export const LoadingSpinner = ({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <svg className={clsx('animate-spin text-accent-500', sizeClasses[size], className)} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
};

export const EmptyState = ({ icon, title, message, action }: {
  icon: React.ReactNode;
  title: string;
  message: string;
  action?: React.ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
    <div className="text-dark-500 mb-4">{icon}</div>
    <h3 className="text-lg font-medium text-dark-100 mb-2">{title}</h3>
    <p className="text-dark-400 mb-4 max-w-sm">{message}</p>
    {action}
  </div>
);

export const Tooltip = ({ children, content }: { children: ReactElement; content: string }) => {
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative inline-block" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      {React.cloneElement(children, { onMouseEnter: () => setVisible(true), onMouseLeave: () => setVisible(false) })}
      {visible && (
        <div
          ref={tooltipRef}
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 text-xs text-dark-100 bg-dark-800 border border-dark-600 rounded-lg shadow-lg whitespace-nowrap"
        >
          {content}
        </div>
      )}
    </div>
  );
};