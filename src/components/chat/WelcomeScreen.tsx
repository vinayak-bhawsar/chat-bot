import BrandLogo from "@/components/common/BrandLogo";

export default function WelcomeScreen() {
  return (
    <section className="w-full max-w-3xl px-4 text-center">
      <div className="flex justify-center mb-5">
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-3xl bg-[#56C5D9]/20 blur-xl scale-125 pointer-events-none" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-zinc-200/80 shadow-md shadow-[#56C5D9]/10 transition-transform duration-300 hover:scale-105">
            <BrandLogo className="h-8 w-8" />
          </div>
        </div>
      </div>

      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
        What can I help with?
      </h1>

      <p className="mt-2.5 text-sm font-normal text-zinc-500 sm:text-base">
        Ask questions about your documents and get intelligent answers.
      </p>
    </section>
  );
}