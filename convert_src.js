require("babel-polyfill");
const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');

const gm = require('gm').subClass({imageMagick: true});
const s3 = new AWS.S3();
const Converter = {};

const opts = {
  src: {
    bucket: 'word-art-svgs'
  },
  dest: {
    bucket: 'word-art-pngs'
  }
};

Converter.getFileName = (url) => url.substring(url.lastIndexOf('/') + 1);
Converter.convertFilename = (filename) => filename.replace(/.svg$/g, '.png');

Converter.downloadImage = params =>
    new Promise((resolve, reject) => {
      console.log('downloadImage start...');
      const destPath = path.join('/tmp', params.Key);
      s3.getObject(params).promise()
          .then((data) => {
            fs.writeFileSync(destPath, data.Body);
            return resolve(destPath);
          })
          .catch(err => reject(err));
    })
;

Converter.imageInfo = imagePath => {
  return new Promise((resolve, reject) => {
    console.log('imageInfo start...');
    gm(imagePath)
        .identify((err, info) => {
          if (err) {
            console.log('Error in imageInfo: ', err)
            return reject(err);
          }
          console.log('Source image info: %j', info);
          return resolve(info);
        });
  });
};

Converter.resizeImage = (imagePath, info, bg_color) => {
  return new Promise((resolve, reject) => {
    console.log('resizeImage start...');
    if (bg_color) {
      gm(imagePath)
          .background(bg_color)
          .density(500)
          .execute(2000)
          .toBuffer(info.format, (err, buffer) => (
              err ? reject(err) : resolve(buffer)
          ));
    } else {
      gm(imagePath)
          .density(500)
          .execute(2000)
          .toBuffer(info.format, (err, buffer) => (
              err ? reject(err) : resolve(buffer)
          ));
    }
  });
};

Converter.uploadImage = (buffer, info) => {
  return new Promise((resolve, reject) => {
    console.log('uploadImage start...');
    const params = {
      Bucket: opts.dest.bucket,
      Key: `${opts.dest.bucket}/${Converter.convertFilename(info["Base filename"])}`,
      Body: buffer,
      ContentType: info['Mime type'],
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
    const image_path = await Converter.downloadImage({
      Bucket: opts.src.bucket,
      Key: Converter.getFileName(image_url)
    });
    const info = await Converter.imageInfo(image_path);
    const imageBuffer = await Converter.resizeImage(image_path, info, bg_color);
    const result = await Converter.uploadImage(imageBuffer, info);
    return result
  } catch (e) {
    return e
  }
};


module.exports.convert = (event, context, callback) => {
  const data = JSON.parse(event.body) || {};
  const src_url = data.url || '';
  const bg_color = data.bg_color || null;
  console.log(JSON.parse(event.body))

  Converter.execute(src_url, bg_color)
      .then(url => {
        const response = {
          statusCode: 200,
          body: JSON.stringify({
            message: 'Your png was successfully generated',
            input_params: JSON.parse(event.body),
            svg_url: src_url,
            png_url: url
          })
        };
        return callback(null, response)
      })
};


