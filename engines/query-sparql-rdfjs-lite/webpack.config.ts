import { createConfig } from '../../webpack.config';

const liteConfig = createConfig(__dirname);

if (typeof liteConfig.performance === 'object') {
  liteConfig.performance.maxAssetSize = 900_500;
  liteConfig.performance.maxEntrypointSize = 900_500;
}

export default liteConfig;
