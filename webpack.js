const path = require('path');
const {merge} = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = (env, args) => {

    const production = args.mode === 'production';
    const commonConfig = {
        entry: './src/index.js',
        output: {
            filename: 'main.[contenthash].js',
            path: path.resolve(__dirname, 'dist'),
            clean: true,
        },
        module: {
            rules: [
                {
                    test: /\.geojson$/,
                    // use: 'json-loader'
                    type: 'json',
                },
                {
                    test: /\.css$/i,
                    use: ['style-loader', 'css-loader'],
                }
            ],
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: 'src/index.html',
            }),
            new webpack.DefinePlugin({
                PRODUCTION: JSON.stringify(production),
                MAPTILER_KEY: JSON.stringify(production ? 'ds7FPmjF0naz2CRbEFav' : 'KhJqoeUtyeWuJ5Pwg0uj'),
            }),
        ],
        optimization: {
            usedExports: true,
        },
    };

    const devConfig = {};
    const prodConfig = {};

    return merge(commonConfig, production ? prodConfig : devConfig);
}
