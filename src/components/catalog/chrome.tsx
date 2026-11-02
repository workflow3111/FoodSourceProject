import { Link } from "@/i18n/navigation";

export function PageIntro({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
      {description ? (
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export function CardSkeletonGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="h-64 animate-pulse rounded-xl border bg-card" />
      ))}
    </div>
  );
}

export function PanelSkeleton() {
  return <div className="h-80 animate-pulse rounded-xl border bg-card" />;
}

export function EmptyState({
  title,
  text,
  href,
  action,
}: {
  title: string;
  text: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{text}</p>
      {href && action ? (
        <Link
          href={href}
          className="mt-4 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          {action}
        </Link>
      ) : null}
    </div>
  );
}

export function ErrorState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action: string;
}) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-card px-6 py-12 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{text}</p>
      <a
        href=""
        className="mt-4 inline-flex h-9 items-center rounded-md border bg-background px-4 text-sm font-medium"
      >
        {action}
      </a>
    </div>
  );
}
