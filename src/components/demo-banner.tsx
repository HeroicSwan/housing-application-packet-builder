import { ShieldAlert } from "lucide-react";

export function DemoBanner() {
  return (
    <div
      className="no-print border-b border-white/20 bg-[#0b3a67] text-white"
      role="status"
      aria-label="Synthetic demonstration environment warning"
      data-demo-banner
    >
      <div className="mx-auto flex min-h-11 max-w-[1440px] items-center justify-center gap-2 px-4 py-2 text-center text-sm font-semibold leading-5 sm:text-left">
        <ShieldAlert aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.25} />
        <span>
          Synthetic demonstration environment. Do not enter real applicant information.
        </span>
      </div>
    </div>
  );
}
