const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode && argv.mode == 'production';
  return {
    mode: isProduction ? 'production' : 'development',
    entry: './src/index.ts',
    plugins: [
      new HtmlWebpackPlugin({
        title: 'WebGPU glTF 2.0 viewer',
        template: 'src/index.html',
      }),
    ],
    devtool: 'inline-source-map',
    devServer: {
      static: {
        directory: path.join(__dirname, 'public'),
        publicPath: '/public',
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
      filename: 'main.js',
      path: path.resolve(__dirname, 'dist'),
      publicPath: isProduction ? '/webgpu-gltf-viewer/' : '/',
      clean: true,
    },
  };
};
