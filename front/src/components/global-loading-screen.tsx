type GlobalLoadingScreenProps = {
  message?: string;
  detail?: string;
};

export const GlobalLoadingScreen = ({
  message = "画面を読み込んでいます...",
  detail = "少々お待ちください。",
}: GlobalLoadingScreenProps) => {
  return (
    <div
      data-testid="global-loading-screen"
      className="global-loading-canvas flex min-h-screen items-center justify-center px-4"
    >
      <section className="global-loading-panel w-full max-w-md rounded-[36px] px-7 py-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/80 shadow-[0_18px_30px_rgba(61,64,91,0.12)]">
          <div className="global-loading-spinner h-9 w-9 rounded-full" />
        </div>
        <p className="mt-6 text-base font-bold text-[color:var(--foreground)]">{message}</p>
        <p className="mt-2 text-sm text-[color:var(--foreground)]/62">{detail}</p>
      </section>
    </div>
  );
};
