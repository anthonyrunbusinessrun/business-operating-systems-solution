import { themeCss } from "@/lib/theme/themes";

/** All themes as CSS variables, once, in the document head. The active one is chosen by `<html data-theme>`. */
export function ThemeStyles() {
  return <style id="boss-themes" dangerouslySetInnerHTML={{ __html: themeCss() }} />;
}
