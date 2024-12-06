import { createConfig } from '../../webpack.config';

const liteConfig = createConfig(__dirname);

if (typeof liteConfig.performance === 'object') {
  liteConfig.performance.maxAssetSize = 900_100;
  liteConfig.performance.maxEntrypointSize = 900_100;
}

export default liteConfig;
