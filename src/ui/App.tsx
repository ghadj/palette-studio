import { ImageInputs } from "./DropZone";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { PhoneTabBar, Shell, useLayout } from "./Shell";
import { Toast } from "./Toast";

export function App() {
  const layout = useLayout();
  return (
    <div id="app-root" class={`app app--${layout}`}>
      <Header layout={layout} />
      <Shell layout={layout} />
      <Footer />
      {layout === "phone" && <PhoneTabBar />}
      <Toast />
      <ImageInputs />
    </div>
  );
}
