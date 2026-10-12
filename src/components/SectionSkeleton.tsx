interface SectionSkeletonProps {
  label: string;
}

export default function SectionSkeleton({ label }: SectionSkeletonProps) {
  return (
    <div
      className="mx-auto max-w-4xl space-y-3 sm:space-y-4 lg:max-w-[1600px]"
      role="status"
      aria-label={label}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50">
          <span className="h-4 w-4 rounded-full border-2 border-blue-600/25 border-t-blue-600 motion-safe:animate-spin motion-reduce:animate-none" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-slate-700">{label}</p>
          <div className="mt-1.5 h-2 w-28 max-w-full rounded-full bg-slate-100 motion-safe:animate-pulse motion-reduce:animate-none" />
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-6">
        <div className="h-2.5 w-24 rounded-full bg-slate-100 motion-safe:animate-pulse motion-reduce:animate-none" />
        <div className="mt-3 h-5 w-3/5 rounded-lg bg-slate-100 motion-safe:animate-pulse motion-reduce:animate-none" />
        <div className="mt-2 h-2.5 w-full rounded-full bg-slate-50" />
        <div className="mt-2 h-2.5 w-4/5 rounded-full bg-slate-50" />
        <div className="mt-5 grid grid-cols-2 gap-2 sm:gap-3">
          <div className="h-16 rounded-2xl bg-slate-50 sm:h-24" />
          <div className="h-16 rounded-2xl bg-slate-50 sm:h-24" />
        </div>
      </div>
    </div>
  );
}
