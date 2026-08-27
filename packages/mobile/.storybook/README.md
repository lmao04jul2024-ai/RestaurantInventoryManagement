# Storybook for @restaurant/mobile (scaffold)

React-Native Storybook pulls heavy dev-only packages (~150 MB). They were kept
out of `dependencies` so CI/device builds stay lean. Enable locally in 3 steps:

## 1. Install dev deps

```bash
npm install -D \
  @storybook/react-native@^7.6.0 \
  @storybook/addon-ondevice-actions@^7.6.0 \
  @storybook/addon-ondevice-controls@^7.6.0 \
  @gorhom/bottom-sheet@^4.6.0 \
  react-dom@18.2.0 \
  --workspace=@restaurant/mobile
```

## 2. Point the entry at stories

Create a storybook-only Metro entry (template below lives at
`.storybook/index.js`) and run Metro with it:

```bash
npx react-native start --config-path .storybook
```

`index.js` template:

```js
import { view } from './storybook.requires';
import AsyncStorage from '@react-native-async-storage/async-storage';

const StorybookUIRoot = view.getStorybookUI({
  storage: { class: AsyncStorage, key: '@restaurant/storybook' },
});
export default StorybookUIRoot;
```

Then temporarily switch `index.js` to import this root instead of `./src/App`.

## 3. Write stories

Stories are colocated as `*.stories.tsx` next to each component, e.g.
`src/components/ui/Button.stories.tsx`:

```tsx
import { Button } from './Button';

export default { title: 'Button' };
export const Primary = () => <Button title="Primary" onPress={() => {}} />;
export const Loading = () => <Button title="Saving…" isLoading onPress={() => {}} />;
```

Until activated, authoritative docs live at `docs/COMPONENTS.md`.
