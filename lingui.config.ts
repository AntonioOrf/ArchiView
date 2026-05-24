import type { LinguiConfig } from '@lingui/conf';
import { formatter } from '@lingui/format-po';

const config: LinguiConfig = {
  locales: ["it", "en"],
  sourceLocale: "it",
  catalogs: [
    {
      path: "src/renderer/locales/{locale}/messages",
      include: ["src/renderer/js"]
    }
  ],
  format: formatter({ lineNumbers: false }),
};

export default config;
