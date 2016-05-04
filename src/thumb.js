'use strict';

function getThumbnailSize(width, height) {
    if (!width || !height) {
        return [100,100];
    }

    let thumbWidth, thumbHeight;
    const baseSize = 10*Math.log(Math.max(width, height));
    if (height < width) {
        thumbWidth = Math.round(baseSize + width / height * baseSize*0.12);
        thumbHeight = Math.round(height / width * thumbWidth);
    } else {
        thumbHeight = Math.round(baseSize + height / width * baseSize*0.12);
        thumbWidth = Math.round(width / height * thumbHeight);
    }
    if (thumbWidth > width) {
        thumbWidth = width;
        thumbHeight = height;
    }
    return [thumbWidth, thumbHeight];
}

exports.getThumbnailSize = getThumbnailSize;
