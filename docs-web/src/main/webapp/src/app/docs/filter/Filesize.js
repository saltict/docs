'use strict';

/**
 * Format file sizes.
 */
angular.module('docs').filter('filesize', function($translate) {
  return function(text) {
    if (!text) {
      return '';
    }

    var size = parseInt(text);
    if (size > 1048576) { // 1MB
      return Math.round(size / 1048576) + $translate.instant('filter.filesize.mb');
    }
    return Math.round(size / 1024) + $translate.instant('filter.filesize.kb');
  }
});