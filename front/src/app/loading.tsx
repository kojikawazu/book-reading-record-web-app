import { GlobalLoadingScreen } from "@/components/global-loading-screen";

/** App Router のルートローディング UI。ページ遷移時のサスペンス中に表示される。 */
export default function Loading() {
  return <GlobalLoadingScreen message="ページを準備しています..." />;
}
