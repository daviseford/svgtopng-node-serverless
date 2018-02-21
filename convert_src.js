require("babel-polyfill");
const AWS = require('aws-sdk');
const sharp = require('sharp');
const s3 = new AWS.S3();
const Converter = {};

const opts = {
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

Converter.getFileName = (url) => url.substring(url.lastIndexOf('/') + 1);
Converter.convertFilename = (filename) => filename.replace(/.svg$/g, '.png');

Converter.downloadImage = params => {
  return new Promise((resolve, reject) => {
    console.log('downloadImage start...');
    s3.getObject(params).promise()
        .then((data) => resolve(data.Body))
        .catch(err => reject(err));
  });
};

Converter.resizeImage = (buffer, bg_color) => {
  return new Promise((resolve, reject) => {
    console.log('resizeImage start...');
    if (bg_color) {
      sharp(buffer)
          .resize(opts.resize.min_width)
          .withoutEnlargement()
          .background(bg_color)
          .flatten()
          .toBuffer((err, buffer, info) => (
              err ? reject(err) : resolve(buffer)
          ));
    } else {
      sharp(buffer)
          .resize(opts.resize.min_width)
          .withoutEnlargement()
          .toBuffer((err, buffer, info) => (
              err ? reject(err) : resolve(buffer)
          ));
    }
  });
};

Converter.uploadImage = (buffer, filename) => {
  return new Promise((resolve, reject) => {
    console.log('uploadImage start...');
    const params = {
      Bucket: opts.dest.bucket,
      Key: filename,
      Body: buffer,
      ContentType: 'image/png',
      StorageClass: 'REDUCED_REDUNDANCY',
      ACL: 'public-read',
    };

    s3.upload(params, (err, data) => (
        err ? reject(err) : resolve(data)
    ));
  })

};

Converter.execute = async (image_url, bg_color = null) => {
  try {
    console.log(image_url, bg_color)
    const src_filename = Converter.getFileName(image_url)
    const dest_filename = Converter.convertFilename(src_filename)
    const src_buffer = await Converter.downloadImage({
      Bucket: opts.src.bucket,
      Key: Converter.getFileName(image_url)
    });
    const dest_buffer = await Converter.resizeImage(src_buffer, bg_color)
    const result = await Converter.uploadImage(dest_buffer, dest_filename);
    return result
  } catch (e) {
    return e
  }
};

// Uncomment to test locally
// Converter.execute('https://s3.amazonaws.com/word-art-svgs/2134198821169.svg', '#000')
//     .then(r => console.log(r))
//     .catch(e => console.log(e))

module.exports.convert = (event, context, callback) => {
  const data = JSON.parse(event.body) || {};
  const src_url = data.url || '';
  const bg_color = data.bg_color || null;

  Converter.execute(src_url, bg_color)
      .then(res => {
        const response = {
          statusCode: 200,
          body: JSON.stringify({
            message: 'Your .png file was successfully generated',
            input_params: data,
            svg_url: src_url,
            png_url: res.Location
          })
        };
        return callback(null, response)
      })
};


