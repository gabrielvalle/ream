const webpack = require('webpack')
const Config = require('webpack-chain')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const nodeExternals = require('webpack-node-externals')
const VueSSRPlugin = require('vue-ssr-webpack-plugin')
const _ = require('./utils')
const cssLoaders = require('./css-loaders')

module.exports = function ({
  type, // ['server', 'client']
  dev, // true / false
  cwd = _.cwd(),
  html
} = {}) {
  const config = new Config()
  const isServer = type === 'server'
  const isClient = type === 'client'

  // add alias
  config.resolve.alias
    .set('@unvue', _.ownDir())
    .set('@cwd', _.cwd(cwd))
    .set('@webpack-hot-middleware-client', `webpack-hot-middleware/client?reload=true`)

  // disable performance
  config.performance
    .hints(false)

  // loaders
  config.module
    .rule('js')
      .test(/\.js$/)
      .include
        .add(_.cwd(cwd, 'src'))
        .add(_.ownDir('app'))
        .end()
      .use('babel')
        .loader('babel-loader')
        .end()
      .end()
    .rule('vue')
      .test(/\.vue$/)
      .use('vue')
        .loader('vue-loader')
        .end()
      .end()

  cssLoaders.standalone({
    extract: !dev,
    sourceMap: true
  }).forEach(loaders => {
    const rule = config.module
      .rule(loaders.extension)
      .test(loaders.test)
    const use = rule.use.bind(rule)
    if (dev) {
      loaders.use
        .forEach(loader => use(loader).loader(loader))
    } else {
      loaders.use
        .forEach(loader => use(loader.loader).loader(loader.loader).options(loader.options))
    }
  })

  // loader options
  config.plugin('loaderOptions')
    .use(webpack.LoaderOptionsPlugin, [{
      options: {
        babel: {
          babelrc: false,
          presets: [require.resolve('babel-preset-vue-app')]
        },
        vue: {
          loaders: {
            js: 'babel-loader'
          }
        }
      }
    }])

  // define envs
  config.plugin('defineEnvs')
    .use(webpack.DefinePlugin, [{
      'process.env.NODE_ENV': JSON.stringify(dev ? 'development' : 'production'),
      'process.env.VUE_ENV': JSON.stringify(type)
    }])

  if (isClient) {
    config
      .entry('client')
        .add('@unvue/app/client-entry')
        .end()
      .output
        .path(_.cwd(cwd, 'dist'))
        .filename(dev ? '[name].js' : '[name].[chunkhash:8].js')
        .publicPath('/dist/')
        .end()

    // generate hmtl
    config.plugin('html')
    .use(HtmlWebpackPlugin, [Object.assign({
      title: 'UNVUE',
      template: _.ownDir('app/index.html')
    }, html)])

    if (dev) {
      config
        .entry('client')
          .prepend(_.ownDir('app/dev-client.js'))
          .end()
        .plugin('hmr')
          .use(webpack.HotModuleReplacementPlugin)
          .end()
        .plugin('no-emit-on-errors')
          .use(webpack.NoEmitOnErrorsPlugin)

    } else {
      config.plugin('uglify')
        .use(webpack.optimize.UglifyJsPlugin, [{
          compress: {
            warnings: false
          }
        }])
    }
  }

  if (isServer) {
    config
      .entry('server')
        .add('@unvue/app/server-entry.js')
        .end()
      .output
        .path(_.cwd(cwd, 'dist'))
        .filename('server-bundle.js')
        .libraryTarget('commonjs2')
        .publicPath('/dist/')

    config.target('node')

    config.externals([
      nodeExternals()
    ])

    config.plugin('ssr')
      .use(VueSSRPlugin, [{
        entry: 'server'
      }])
  }

  return config.toConfig()
}