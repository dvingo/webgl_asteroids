const path = require('path')

module.exports = {
  entry: './js/js.js',
  output: {
    filename: 'bundle.js',
    path: path.join(__dirname, 'dist')
  }
}
