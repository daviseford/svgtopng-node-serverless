'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

require("babel-polyfill");
var AWS = require('aws-sdk');
var sharp = require('sharp');
var s3 = new AWS.S3();
var Converter = {};

var opts = {
  resize: {
    min_width: 2000
  },
  src: {
    bucket: 'word-art-svgs'
  },
  dest: {
    bucket: 'word-art-pngs'
  }
};

Converter.getFileName = function (url) {
  return url.substring(url.lastIndexOf('/') + 1);
};
Converter.convertFilename = function (filename) {
  return filename.replace(/.svg$/g, '.png');
};

Converter.downloadImage = function (params) {
  return new Promise(function (resolve, reject) {
    console.log('downloadImage start...');
    s3.getObject(params).promise().then(function (data) {
      return resolve(data.Body);
    }).catch(function (err) {
      return reject(err);
    });
  });
};

Converter.resizeImage = function (buffer, bg_color) {
  return new Promise(function (resolve, reject) {
    console.log('resizeImage start...');
    if (bg_color) {
      sharp(buffer).resize(opts.resize.min_width).withoutEnlargement().background(bg_color).flatten().rotate(90).toBuffer(function (err, buffer, info) {
        return err ? reject(err) : resolve(buffer);
      });
    } else {
      sharp(buffer).resize(opts.resize.min_width).withoutEnlargement().rotate(90).toBuffer(function (err, buffer, info) {
        return err ? reject(err) : resolve(buffer);
      });
    }
  });
};

Converter.uploadImage = function (buffer, filename) {
  return new Promise(function (resolve, reject) {
    console.log('uploadImage start...');
    var params = {
      Bucket: opts.dest.bucket,
      Key: filename,
      Body: buffer,
      ContentType: 'image/png',
      StorageClass: 'REDUCED_REDUNDANCY',
      ACL: 'public-read'
    };

    s3.upload(params, function (err, data) {
      return err ? reject(err) : resolve(data);
    });
  });
};

Converter.execute = function () {
  var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(image_url) {
    var bg_color = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    var src_filename, dest_filename, src_buffer, dest_buffer, result;
    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.prev = 0;

            console.log(image_url, bg_color);
            src_filename = Converter.getFileName(image_url);
            dest_filename = Converter.convertFilename(src_filename);
            _context.next = 6;
            return Converter.downloadImage({
              Bucket: opts.src.bucket,
              Key: Converter.getFileName(image_url)
            });

          case 6:
            src_buffer = _context.sent;
            _context.next = 9;
            return Converter.resizeImage(src_buffer, bg_color);

          case 9:
            dest_buffer = _context.sent;
            _context.next = 12;
            return Converter.uploadImage(dest_buffer, dest_filename);

          case 12:
            result = _context.sent;
            return _context.abrupt('return', result);

          case 16:
            _context.prev = 16;
            _context.t0 = _context['catch'](0);
            return _context.abrupt('return', _context.t0);

          case 19:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, undefined, [[0, 16]]);
  }));

  return function (_x2) {
    return _ref.apply(this, arguments);
  };
}();

// Uncomment to test locally
// Converter.execute('https://s3.amazonaws.com/word-art-svgs/2134198821169.svg', '#000')
//     .then(r => console.log(r))
//     .catch(e => console.log(e))

module.exports.convert = function (event, context, callback) {
  var data = JSON.parse(event.body) || {};
  var src_url = data.url || '';
  var bg_color = data.bg_color || null;

  Converter.execute(src_url, bg_color).then(function (res) {
    var response = {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({
        message: 'Your .png file was successfully generated',
        input_params: data,
        svg_url: src_url,
        png_url: res.Location
      })
    };
    return callback(null, response);
  });
};
