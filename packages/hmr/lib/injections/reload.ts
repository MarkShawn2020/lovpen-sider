import initClient from '../initializers/init-client.js';

(async () => {
  const reload = () => {
    chrome.runtime.reload();
  };

  await initClient({
    // @ts-expect-error That's because of the dynamic code loading
    id: __HMR_ID,
    onUpdate: reload,
  });
})();
