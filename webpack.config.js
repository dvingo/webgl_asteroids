const path = require('path')

module.exports = {
  entry: './js/js.js',
  output: {
    filename: 'bundle.js',
    publicPath: '/',
    path: path.join(__dirname, 'dist')
  }
}
