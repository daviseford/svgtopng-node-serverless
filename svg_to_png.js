var fs = require('fs');
var svg2img = require('svg2img');

//3. convert from a local file
svg2img(__dirname + '/a.svg', function (error, buffer) {
  fs.writeFileSync('foo3.png', buffer);
});

