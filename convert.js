'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

require("babel-polyfill");
var AWS = require('aws-sdk');
var path = require('path');
var fs = require('fs');

var gm = require('gm').subClass({ imageMagick: true });
var s3 = new AWS.S3();
var Converter = {};

var opts = {
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
    var destPath = path.join('/tmp', params.Key);
    s3.getObject(params).promise().then(function (data) {
      fs.writeFileSync(destPath, data.Body);
      return resolve(destPath);
    }).catch(function (err) {
      return reject(err);
    });
  });
};

Converter.imageInfo = function (imagePath) {
  return new Promise(function (resolve, reject) {
    console.log('imageInfo start...');
    gm(imagePath).identify(function (err, info) {
      if (err) {
        console.log('Error in imageInfo: ', err);
        return reject(err);
      }
      console.log('Source image info: %j', info);
      return resolve(info);
    });
  });
};

Converter.resizeImage = function (imagePath, info, bg_color) {
  return new Promise(function (resolve, reject) {
    console.log('resizeImage start...');
    if (bg_color) {
      gm(imagePath).background(bg_color).density(500).execute(2000).toBuffer(info.format, function (err, buffer) {
        return err ? reject(err) : resolve(buffer);
      });
    } else {
      gm(imagePath).density(500).execute(2000).toBuffer(info.format, function (err, buffer) {
        return err ? reject(err) : resolve(buffer);
      });
    }
  });
};

Converter.uploadImage = function (buffer, info) {
  return new Promise(function (resolve, reject) {
    console.log('uploadImage start...');
    var params = {
      Bucket: opts.dest.bucket,
      Key: opts.dest.bucket + '/' + Converter.convertFilename(info["Base filename"]),
      Body: buffer,
      ContentType: info['Mime type'],
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
    var image_path, info, imageBuffer, result;
    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.prev = 0;
            _context.next = 3;
            return Converter.downloadImage({
              Bucket: opts.src.bucket,
              Key: Converter.getFileName(image_url)
            });

          case 3:
            image_path = _context.sent;
            _context.next = 6;
            return Converter.imageInfo(image_path);

          case 6:
            info = _context.sent;
            _context.next = 9;
            return Converter.resizeImage(image_path, info, bg_color);

          case 9:
            imageBuffer = _context.sent;
            _context.next = 12;
            return Converter.uploadImage(imageBuffer, info);

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

module.exports.convert = function (event, context, callback) {
  var data = JSON.parse(event.body) || {};
  var src_url = data.url || '';
  var bg_color = data.bg_color || null;
  console.log(JSON.parse(event.body));

  Converter.execute(src_url, bg_color).then(function (url) {
    var response = {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Your png was successfully generated',
        input_params: JSON.parse(event.body),
        svg_url: src_url,
        png_url: url
      })
    };
    return callback(null, response);
  });
};
