import globalConfig from '@extension/tailwindcss-config';
import { withUI } from '@extension/ui';

export default withUI({
  content: ['index.html', 'src/**/*.tsx'],
  presets: [globalConfig],
});
