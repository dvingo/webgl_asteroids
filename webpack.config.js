const path = require('path')

module.exports = {
  entry: './js/js.js',
  output: {
    filename: 'bundle.js',
    publicPath: '/',
    path: path.join(__dirname, 'dist')
  },
  resolve: {
    modules: [__dirname, 'node_modules']
  },
  module: {
    rules: [
      {test: /\.json$/, use: 'json-loader'},
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        query: {
          presets: ['env']
        }
      }
    ]
  }
}
