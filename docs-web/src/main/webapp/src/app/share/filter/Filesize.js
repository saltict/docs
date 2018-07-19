'use strict';

/**
 * Format file sizes.
 */
angular.module('share').filter('filesize', function() {
  return function(text) {
    if (!text) {
      return '';
    }

    var size = parseInt(text);
    if (size > 1048576) { // 1MB
      return Math.round(size / 1048576) + 'MB';
    }
    return Math.round(size / 1024) + 'kB';
  }
});