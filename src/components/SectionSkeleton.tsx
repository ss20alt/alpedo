interface SectionSkeletonProps {
  label: string;
}

export default function SectionSkeleton({ label }: SectionSkeletonProps) {
  return (
    <div
      className="mx-auto max-w-4xl space-y-4 animate-pulse"
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <div className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-6">
        <div className="h-3 w-24 rounded-full bg-slate-200" />
        <div className="mt-4 h-6 w-3/5 rounded-lg bg-slate-200" />
        <div className="mt-3 h-3 w-full rounded-full bg-slate-100" />
        <div className="mt-2 h-3 w-4/5 rounded-full bg-slate-100" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="h-24 rounded-[22px] border border-slate-100 bg-white" />
        <div className="h-24 rounded-[22px] border border-slate-100 bg-white" />
      </div>
    </div>
  );
}
