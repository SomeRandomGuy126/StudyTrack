import { type ReactNode } from 'react';

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && <div className="text-tertiary mb-4">{icon}</div>}
      <h3 className="text-primary font-semibold mb-1">{title}</h3>
      {description && <p className="text-secondary text-sm max-w-sm mb-4">{description}</p>}
      {action}
    </div>
  );
}

type SpinnerProps = { size?: number; className?: string };
export function Spinner({ size = 20, className = '' }: SpinnerProps) {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

type BadgeProps = { children: ReactNode; color?: string; className?: string };
export function Badge({ children, color, className = '' }: BadgeProps) {
  const style = color
    ? { backgroundColor: `${color}20`, color }
    : undefined;
  return (
    <span className={`badge ${className}`} style={style}>
      {children}
    </span>
  );
}

type ProgressBarProps = {
  value: number;
  max?: number;
  color?: string;
  className?: string;
};
export function ProgressBar({ value, max = 100, color = 'var(--accent)', className = '' }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={`h-2 rounded-full overflow-hidden surface-tertiary ${className}`}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

type ConfidenceDotsProps = { value: number; onChange?: (v: number) => void; size?: number };
export function ConfidenceDots({ value, onChange, size = 16 }: ConfidenceDotsProps) {
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'];
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={`rounded-full transition-all ${onChange ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
          style={{
            width: size,
            height: size,
            backgroundColor: n <= value ? colors[n - 1] : 'var(--border-color)',
          }}
          title={`Confidence ${n}/5`}
        />
      ))}
    </div>
  );
}
