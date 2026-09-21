import { HTMLAttributes } from 'react';

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`liquid-glass p-0 ${className}`}
      {...props}
    />
  );
}

export function CardHeader({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-6 pb-0 ${className}`} {...props} />;
}

export function CardTitle({ className = '', ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={`text-lg font-semibold tracking-tight text-fg ${className}`}
      {...props}
    />
  );
}

export function CardDescription({ className = '', ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={`mt-1 text-sm leading-relaxed text-fg-secondary ${className}`}
      {...props}
    />
  );
}

export function CardContent({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-6 ${className}`} {...props} />;
}

export function CardFooter({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex items-center p-6 pt-0 ${className}`}
      {...props}
    />
  );
}

type StatRowProps = {
  label: string;
  sublabel?: string;
  value: string;
  tone?: 'default' | 'success' | 'danger' | 'accent';
};

export function StatRow({
  label,
  sublabel,
  value,
  tone = 'default',
}: StatRowProps) {
  const toneClass = {
    default: 'text-fg',
    success: 'text-success',
    danger: 'text-danger',
    accent: 'text-accent',
  }[tone];

  return (
    <div className="flex items-start justify-between border-b border-border py-3 last:border-0">
      <div>
        <div className="text-sm font-medium text-fg">{label}</div>

        {sublabel && (
          <div className="mt-0.5 text-xs text-fg-muted">
            {sublabel}
          </div>
        )}
      </div>

      <div className={`font-nums text-sm font-semibold ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}
