import { ReactNode, HTMLAttributes } from 'react';

/* Base Card — themed to dark/orange tokens */
export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-surface border border-border rounded-lg shadow-card ${className}`}
      {...props}
    />
  );
}

/* Sub-components your auth pages (login, sign-up, forgot-password,
   update-password, error) already import — kept so nothing breaks */
export function CardHeader({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-6 pb-0 ${className}`} {...props} />;
}

export function CardTitle({ className = '', ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={`text-lg font-semibold text-fg ${className}`} {...props} />;
}

export function CardDescription({ className = '', ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`text-sm text-fg-secondary mt-1 ${className}`} {...props} />;
}

export function CardContent({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-6 ${className}`} {...props} />;
}

export function CardFooter({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-6 pt-0 flex items-center ${className}`} {...props} />;
}

/* New addition for P&L / financial line items */
type StatRowProps = {
  label: string;
  sublabel?: string;
  value: string;
  tone?: 'default' | 'success' | 'danger' | 'accent';
};

export function StatRow({ label, sublabel, value, tone = 'default' }: StatRowProps) {
  const toneClass = {
    default: 'text-fg',
    success: 'text-success',
    danger: 'text-danger',
    accent: 'text-accent',
  }[tone];

  return (
    <div className="flex items-start justify-between py-3 border-b border-border last:border-0">
      <div>
        <div className="text-sm font-medium text-fg">{label}</div>
        {sublabel && <div className="text-xs text-fg-muted mt-0.5">{sublabel}</div>}
      </div>
      <div className={`font-nums text-sm font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}